express = require('express')
everyauth = require 'everyauth'
conf = require './conf'
dbox = require 'dbox'
mongoose = require 'mongoose'
connect = require 'connect'
RedisStore = require('connect-redis')(connect)
_ = require 'underscore'
util = require 'util'
async = require 'async'
stylus = require 'stylus'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId
log = console.log
dir = console.dir
{ ValidateError, InternalServerError, UserNotFound, NotFound, errorHandler } = require('./coffee/errors')
{ User, Login, Dropbox, Project } = require('./coffee/models.coffee')

compile = (str, path) ->
  stylus(str)
    .import(__dirname + '/stylesheets/mixins')
    .set('filename', path)
    .set('warn', true)
    .set('compress', true)

mongoose.connect 'mongodb://localhost/mydb'

client = dbox.createClient
  app_key: conf.dropbox.consumerKey
  app_secret: conf.dropbox.consumerSecret
  root: "sandbox"



everyauth.everymodule
  .findUserById (id, callback) ->
    log 'find user by id'
    User.findById id, (err, doc) ->
      log 'find user'
      if(err)
        callback err, null
      else if(!doc)
        callback new Error('no such id : ' + id, null)
      else
        callback null, doc


createUserWithDropbox = (promise, metadata)->
  userName = metadata.display_name + Math.random().toString(16).substr(2)
  user = null
  async.reduce [
    (name) ->
      return (user = new User({name: name}));
    (data) ->
      options = _.extend { user: data._id }, metadata
      return new Dropbox(options)
  ], userName,
    (data, func, callback) ->
      obj = func data
      log 'getObj'
      dir obj 
      obj.save callback
    (err, dropbox) ->
      if err
        log 'err!!!'
        dir err
        promise.fulfill [err]
      else
        log 'result!!!'
        promise.fulfill user
         
everyauth
  .dropbox
    .consumerKey(conf.dropbox.consumerKey)
    .consumerSecret(conf.dropbox.consumerSecret)
    .redirectPath('/')
    .findOrCreateUser (sess, accessToken, accessSecret, metadata) ->
      # TODO - if already loggedIn, add User account Dropbox
      log '== find or create user =='
      promise = this.Promise()
      Dropbox
        .findOne({ uid: metadata.uid })
        .populate('user')
        .exec (err0, doc0) ->
          log 'find callback'
          if doc0
            log 'has user'
            promise.fulfill doc0
          else
            log 'no user'
            createUserWithDropbox(promise, metadata)
      return promise
    

app = express.createServer()
app.configure ->
  app.set 'view engine', 'jade'
  app.use express.bodyParser()
  app.use express.cookieParser()
  app.use express.session
    store: new RedisStore
    secret: 'keyboard cat'
  app.use everyauth.middleware()
  app.use express.methodOverride()
  # TODO - production version not compile each time
  app.use stylus.middleware
    src: __dirname
    dest: __dirname + '/public'
    compile: compile
  app.use app.router
  app.use errorHandler
  app.use express.static __dirname + '/public'


app.configure 'development', ->
  everyauth.debug = true;
  app.use express.errorHandler
    dumpExceptions: true
    showStack: true


app.configure 'production', ->
  app.use express.errorHandler()
  log = dir = ->


everyauth.helpExpress(app)

##### params #####

app.param 'userId', (req, res, next, id) ->
  User.findById id, (err, doc) ->
    return next(err) if err
    return next(new Error('no such user id: ' + id )) if !doc
    req.user = doc
    req.userId = doc._id
    next()

app.param 'projectId', (req, res, next, id) ->
  Project.findById id, (err, doc) ->
    return next(err) if err
    return next(new NotFound('no such project id : ') + id) if !doc
    req.project = doc
    next()

##### views #####

# index
app.get '/', (req, res) ->
  #log 'session'
  dir req.session
  res.render 'home',
    title: 'home'

# login
app.get '/login', (req, res) ->
  res.render 'login',
    title: 'login'

# logout
app.get '/logout', (req, res) ->
  req.session.destroy()
  res.redirect('/')

# account
app.get '/account/:userId', (req, res) ->
  if(!req.session.user)
    res.redirect('login')
  if(req.session.userId != req.userId)
    # TODO - Unathrorized error
    throw new Error('seccurity')
  res.render 'account',
    title: 'account'

# project

app.get '/post/new', (req, res) ->
  log '===post new==='
  # TODO - add data
  res.render 'post/new',
    title: 'new post'
    


# app.post '/project/create', (req, res) ->
#   log '== post pro cre'
#validateProject, ensureToken, ensureFile, createProject,
validateProject = (req, res, next) ->
  log 'validateProject'
  body = req.body
  title = body.title
  desc = body.description
  # TODO more nicely
  msg = null
  if !title or !desc
    msg = 'title and description is nessesary'
  else if title.length > 20
    msg = 'title has limit 20 lenght'
  else if desc.length > 100
    msg = 'description has limit 100 length'
  
  if(msg)
    res.render 'post/new',
      title: 'post/new'
      # TODO more nicer msg
      msg: msg
  else
    next()

ensureToken = (req, res, next) ->
  log 'ensureToken'
  # TODO - if not logged in or logged in as dropbox, auth it.
  next()
    

ensureFile = (req, res, next) ->
  log 'ensureFile'
  dir req.session
  body = req.body
  title = body.title
  desc = body.description
  fileName = title + '.json'
  dropbox = req.session.auth.dropbox
  
  
  
  accessToken = dropbox.accessToken
  accessTokenSecret = dropbox.accessTokenSecret
  options =
    oauth_token: accessToken
    oauth_token_secret: accessTokenSecret
    
  

  async.waterfall [
    # put file if there isn't
    # TODO - how to do inital json
    (callback) ->
      client.put fileName, '{}', _.extend({ overwrite: false}, options), (status, reply) ->
        if status == 200
          callback null
        else
          callback new Error(status), reply
    (callback) ->
      client.shares fileName, options, (status, reply) ->
        if status == 200
          callback null, reply
        else
          callback new Error(status), reply
  ], (err, result) ->
    if err
      next(new InternalServerError('dropbox ensureFile error'))
    else
      log 'share result'
      dir result
      req.shares = result
      next()


createProject = (req, res, next) ->
  log 'createProject'
  body = req.body
  userId = req.session.auth.userId
  options =
    title: body.title
    description: body.description
    editors: [{
      user: null
      url: req.shares.url
    }]
  log 'options'
  dir options
  async.auto
    user: (callback) ->
      User.findById userId, (err, doc) ->
        if doc
          callback null, doc
        else
          callback((err || new Error('no such id: ' + userId) ), null)
    project: [ 'user', (callback, result) ->
      options.editors[0].user = result.user._id
      log options
      dir options
      project = new Project(options)
      project.save (err, doc) ->
        callback err, doc
    ],
    updateUser: [ 'project', 'user', (callback, result) ->
      user = result.user
      project = result.project
      project = result.project[0] if _.isArray(project)
      log('pro')
      dir( project )
      user.editings.push project._id
      user.save (err, doc) ->
        callback err, doc
    ]
  , (err, result) ->
    # TODO - how to revert transaction??
    log('err')
    dir( err )
    log result
    dir result
    return next err if err
    dir( result )
    req.project = result.project
    next()

projectConnect = [ ensureToken, validateProject, ensureFile, createProject ]
app.post '/project/create', projectConnect, (req, res) ->
  
  # shared link url
  # TODO - all user's link url
  log 'project/create'
  res.redirect('/project/' + req.project._id)
  # res.render 'post/project',
  #   title: 'post/project'
  #   project: req.project

app.get '/project/:projectId', (req, res) ->
  log 'project'
  # TODO - difference between participants and just viewer
  res.render 'post/project'
    title: req.project.title
    project: req.project

#app.get '/project/search', (req, res) ->
  # TODO - 
  
  
app.listen(3000);
console.log('Go to http://local.host:3000');
