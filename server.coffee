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
      callback null, doc

everyauth
  .dropbox
    .consumerKey(conf.dropbox.consumerKey)
    .consumerSecret(conf.dropbox.consumerSecret)
    .redirectPath('/')
    .findOrCreateUser (sess, accessToken, accessSecret, metadata) ->
      log '== find or create user =='
      promise = this.Promise()
      
      Dropbox
        .findOne { uid: metadata.uid }
        .populate 'user'
        .exec (err0, doc0) ->
          log 'find callback'
          if doc0
            log 'has user'
            promise.fulfill doc0
          else
            log 'no user'
            userName = metadata.display_name + Math.random().toString(16).substr(2)
            user
            async.reduce [
              (name) ->
                return (user = new User({name: name}));
              (data) ->
                options = _.extend { user: data._id }, metadata
                return new Dropbox(options);
            ], userName,
              (data, func, callback) ->
                obj = func data
                log 'getObj'
                dir obj 
                obj.save (err, doc) ->
                  if doc
                    log 'success'
                    callback null, doc
                  else
                    log 'fail'
                    callback err, 'save error'
              (err, dropbox) ->
                if err
                  log 'err!!!'
                  dir err
                  promise.fulfill [err]
                else
                  log 'result!!!'
                  promise.fulfill user
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

app.get '/', (req, res) ->
  #log 'session'
  dir req.session
  res.render 'home',
    title: 'home'

ValidateError = (msg)->
  this.name = 'ValidateError'
  Error.call this, msg
  Error.captureStackTrace this, arguments.callee

# TODO - test json validate error
# TODO - test redirect validate error
app.error (err, req, res, next) ->
  if (err instanceof ValidateError) or (err instanceof InternalServerError)
    if req.xhr
      res.json(err) 
    else
      # TODO how to send error message
      res.redirect('back')
  else
    next(err)
    
InternalServerError = (msg) ->
  this.name = 'InternalServerError'
  Error.call this, msg
  Error.captureStackTrace this, arguments.callee

app.get '/login', (req, res) ->
  res.render 'login',
    title: 'login'


app.get '/logout', (req, res) ->
  req.session.destroy()
  res.redirect('/')

app.get '/account', (req, res) ->
  if(!req.session.user)
    res.redirect('login')
    return;
  
  res.render 'account',
    title: 'account'
  

app.get '/project', (req, res) ->
  res.render 'project', 
    title: 'project'

app.post '/project/create', validateProject, ensureFile, createProject, (req, res) ->
  # shared link url
  # TODO - all user's link url
  res.render 'project_edit',
    title: 'project'
    url: req.shares.url



validateProject = (req, res, next) ->
  body = req.body
  title = body.title
  desc = body.description
  # TODO more nicely
  if !title or !desc or title.length > 20 or desc.length > 100
    res.render 'project',
      title: 'project'
      # TODO more nicer msg
      msg: 'title and description is nessesary and has limit'
  else
    next()

ensureFile = (req, res, next) ->
  body = req.body
  title = body.title
  desc = body.description
  fileName = title + '.json'
  dropbox = req.session.auth.dropbox
  accessToken = dropbox.accessToken
  accessTokenSecret = dropbox.accessTokenSecret
  options =
    oauth_token        : accessToken,
    oauth_token_secret : accessTokenSecret

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
      client.share fileName, options, (status, reply) ->
        if status == 200
          callback null, reply
        else
          callback new Error(status), reply
  ], (err, result) ->
    if err
      log 'error during dropbox access'
      next(new InternalServerError('dropbox ensureFile error'))
    else
      req.shares = result
      next()
    


createProject = (req, res, next) ->
  body = req.body
  userId = req.session.auth.user._id
  options =
    title: body.title
    description: body.description
    editors: [{
      user: userId
      url: req.shares.url
    }]
  log 'options'
  dir options
  async.auto
    project: (callback) ->
      project = new Project(options)
      project.save callback
    user: (callback) ->
      User.findById userId, (err, doc) ->
        if doc
          callback null, doc
        else
          callback((err || new Error('no such id: ' + userId) ), null)
    updateUser: [ 'project', 'user', (callback, result) ->
      user = result.project.user
      user.editings.push result.project._id
      user.save callback
    ]
  (err, result) ->
    return next err if err
    dir( result )
    req.projectModel = result.project
    next()





app.listen(3000);
console.log('Go to http://local.host:3000');
