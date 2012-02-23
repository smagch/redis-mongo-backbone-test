var express = require('express')
  , everyauth = require('everyauth')
  , conf = require('./conf')
  , dbox = require('dbox')
  , mongoose = require('mongoose')
  , connect = require('connect')
  , RedisStore = require('connect-redis')(connect)
  , _ = require('underscore')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , async = require('async')
  , Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId
  ;

mongoose.connect('mongodb://localhost/mydb');


var UserSchema = new Schema({
  name: { type: String },
  editings: [ { type: ObjectId, ref: 'Project' } ]
  //editings: [{ type: ObjectId, ref: 'Editor' }]
});

var LoginSchema = new Schema({
  user: { type: ObjectId, ref: 'User' },
  mail: { type: String, index: { unique : true } },
  password: { type: String }
});

var DropboxSchema = new Schema({
  user: { type: ObjectId, ref: 'User'},
  uid: { type: Number, index: { unique : true }},
  referral_link: { type: String },
  display_name: { type: String },
  country: { type: String },
  quota_info: {
    shared: { type: Number },
    quota: { type: Number },
    normal: { type: Number }
  }
});

var ProjectSchema = new Schema({
  title: { type: String, index: { unique : true }},
  description: { type: String, required: true },
  editors: [ EditorSchema ]
});

var EditorSchema = new Schema({
  user: { type: ObjectId, ref: 'User' },
  // shareable link
  url: { type: String }
});

var 
  User = mongoose.model('User', UserSchema),
  Login = mongoose.model('Login', LoginSchema),
  Dropbox = mongoose.model('Dropbox', DropboxSchema)
  Project = mongoose.model('Project', ProjectSchema);


everyauth.debug = true;

everyauth.everymodule
  .findUserById( function (id, callback) {
    // TODO use Promise??
    console.log('find user by id');
    User.findById(id, function(err, doc) {
      console.log('find user');
      callback(null, doc);
    });
  });


everyauth
  .dropbox
    .consumerKey(conf.dropbox.consumerKey)
    .consumerSecret(conf.dropbox.consumerSecret)
    .findOrCreateUser( function (sess, accessToken, accessSecret, metadata) {
      console.log('== find or create user ==');
      var 
        promise = this.Promise();
      
      Dropbox
        .findOne({uid: metadata.uid})
        .populate('user')
        .exec(function(err0, doc0) {
          console.log('find callback');
          if(doc0) {
            console.log('has user');
            promise.fulfill(doc0);
          } else {
            console.log('no user');
            var userName = metadata.display_name + Math.random().toString(16).substr(2),
              // fulfill user
              user;
            async.reduce([
              function(name) {
                return (user = new User({name: name}));
              },
              function(data) {
                var options = _.extend({user: data._id}, metadata);
                return new Dropbox(options);
              }
            ], userName,
              function(data, func, callback) {
                var obj = func(data);
                console.log('getObj');
                console.dir( obj );
                obj.save(function(err, doc) {
                  if(doc) {
                    console.log('success');
                    callback(null, doc);
                  } else {
                    console.log('');
                    callback(err, 'save error');
                  }
                });
              },
              function(err, dropbox) {
                if(err) {
                  console.log('err!!!');
                  console.dir( err );
                  promise.fulfill([err])
                } else {
                  console.log('result!!!');
                  promise.fulfill(user);
                }
              }
            );
          }
        });
      return promise;
    })
    .redirectPath('/')

var app = express.createServer();
app.configure( function () {
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ store: new RedisStore, secret: 'keyboard cat' }));
  //app.use(express.session({ secret: 'htuayrkjljeve' }));
  app.use(everyauth.middleware());
  app.use(express.methodOverride());
  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function (req, res) {
  console.log('session');
  console.dir( req.session );
  
  res.render('index', {
    title: 'hoem'
  });
});

var client = dbox.createClient({
  app_key    : conf.dropbox.consumerKey,             // required
  app_secret : conf.dropbox.consumerSecret,           // required
  root       : "sandbox"            // optional (defaults to sandbox)
});


// app.dynamicHelpers({
//   session: function(req, res){
//     return req.session;
//   }
// });

// user1 and user2 can edit hoge.txt individually,
// a user can sync with other user, and also reject sync.
// all action have date, if there is new action, notify users if sync with the action.
// automatically sync but diffrent color.
// user3 has logged in. he will see the changes that user1 and user2 did.
// how to implement this??
// 
// database store dropbox id. and permalink to data, and also last edit date.
// send request all of the data.
// Backbone hold all user's data.
// Backbone query actions with date and pull.
// user's action have to save into self dropbox repo.
// all collection data.

// history console show number of each user's changes

// About merge view mode.
// diff - decide difference to see last update date.
// new element - insert
// delete element - show delete line
// modified element show both

// topic discussion also 
app.get('/login', function(req, res) {
  
  res.render('login', {
    title: 'login'
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/');
});

app.get('/account', function(req, res) {
  if(!req.session.user) {
    res.redirect('login');
    return;
  }
  res.render('account', {
    title: 'account'
  });
});

app.get('/project', function(req, res) {
  res.render('project', {
    title: 'project'
  })
});

app.post('/project/create', validateProject, ensureFile, function(req, res) {

  
  
  // TODO see if dropbox login
  // client.share
  client.put('title.json', options, function(status, reply) {
    
  })
  // 1. put file and get sharable link
  // 2. create Project
  // 3. push User.editing
  
  // res.render('', {
  //   
  // });
});

function validateProject(req, res, next) {
  var body = req.body,
    title = body.title,
    desc = body.description;
    
  if(!title || !desc || title.length > 20 || desc.length > 100 ) {
    res.render('project', {
      title: 'project',
      // TODO more nicer msg
      msg: 'title and description is nessesary and has limit'
    });
    return;
  }
  next();
}

function ensureFile(req, res, next) {
  var 
    body = req.body,
    title = body.title,
    desc = body.description,
    fileName = title + '.json',
    dropbox = req.session.auth.dropbox,
    accessToken = dropbox.accessToken,
    accessTokenSecret = dropbox.accessTokenSecret,
    options = {
      oauth_token        : accessToken,
      oauth_token_secret : accessTokenSecret
    };
  
  // client.put(fileName, _.extend({ overwrite: false}, options), function(status, reply) {
  //   if(status == 200) {
  //     client.share(fileName, options, function(status2, reply2) {
  //       if(status2 == 200) {
  //         url = reply2.url;
  //         
  //       }
  //     });
  //   }
  // });
}

app.get('/dropbox/gettext', function(req, res) {
  console.log('get text');
  var dropbox = req.session.auth.dropbox;
  //console.dir( dropbox );
  
  var 
    accessToken = dropbox.accessToken,
    accessTokenSecret = dropbox.accessTokenSecret,
    token = dropbox.token, 
    tokenSecret = dropbox.tokenSecret;
    
  var options = {
    oauth_token        : accessToken,
    oauth_token_secret : accessTokenSecret
    //overwrite         : true,
    //root: 'sandbox'
  };
  var filePath = 'hello.txt';
  // Dropbox.find({}, function(err, docs) {
  //   docs.forEach(function(doc) {
  //     
  //   });
  // });
  // client.shares(filePath, options, function(status, reply){
  //   if(status == 200) {
  //     
  //   }
  // })
  // client.put("hello.txt", "here is some text", options, function(status, reply){
  //   console.log(status)
  //   console.log(reply)
  // })
  res.json({
    hoge: 'hoge'
  });
});

everyauth.helpExpress(app);

app.listen(3000);

console.log('Go to http://local.host:3000');
