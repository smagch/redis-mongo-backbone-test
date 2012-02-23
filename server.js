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
  , Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId
  ;

mongoose.connect('mongodb://localhost/mydb');


var UserSchema = new Schema({
  name: { type: String }
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

var 
  User = mongoose.model('User', UserSchema),
  Login = mongoose.model('Login', LoginSchema),
  Dropbox = mongoose.model('Dropbox', DropboxSchema);


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



function MyEmitter() {
  EventEmitter.call(this);
}
util.inherits(MyEmitter, EventEmitter);
MyEmitter.prototype.error = function() {
  var args = Array.prototype.slice.call(arguments);
  this.emit('error', args);
  this.removeAllListeners();
}
MyEmitter.prototype.success = function() {
  console.log('proto success');
  var args = Array.prototype.slice.call(arguments);
  console.log('before emit');
  this.emit('success', args);
  this.removeAllListeners();
}

function createUser(data, next) {
  var ret = this instanceof MyEmitter ? this : new MyEmitter();
  var user = new User(data);
  
  user.save(function(err, doc) {
    if(err || !doc) {
      ret.error(err);
    } else {
      next.call(ret, doc);
    }
  });
  return ret;
}

function createDropbox(data, next) {
  var ret = this instanceof MyEmitter ? this : new MyEmitter();
  var dropbox = new Dropbox(data);
  
  dropbox.save(function(err, doc) {
    if(err || !doc) {
      ret.error(err);
    } else {
      next.call(ret, doc);
    }
  });
  return ret;
}

everyauth
  .dropbox
    .consumerKey(conf.dropbox.consumerKey)
    .consumerSecret(conf.dropbox.consumerSecret)
    .findOrCreateUser( function (sess, accessToken, accessSecret, metadata) {
      console.log('== find or create user ==');
      var 
        promise = this.Promise(),
        successHandler = function(user, dropbox) {
          console.log('successHandler');
          promise.fulfill(user);
        };
      
      Dropbox
        .findOne({uid: metadata.uid})
        .populate('user')
        .exec(function(err, doc) {
          console.log('find callback');
          if(doc) {
            console.log('has user');
            successHandler(doc.user, doc);
          } else {
            console.log('no user');
            createUser({ name: metadata.display_name }, function(user) {
              console.log('createUser callback');
              createDropbox.call(this, _.extend({ user: user.id }, metadata), function(dropbox) {
                console.log('create dropbox callback');
                this.success(user, dropbox);
              });
            })
            .on('error', function(e) {
              promise.fulfill([e]);
            })
            .on('success', successHandler);
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

app.get('/dropbox/gettext', function(req, res) {
  console.log('get text');
  var dropbox = req.session.auth.dropbox;
  console.dir( dropbox );
  
  var 
    accessToken = dropbox.accessToken,
    accessTokenSecret = dropbox.accessTokenSecret,
    token = dropbox.token, 
    tokenSecret = dropbox.tokenSecret;
    
  var options = {
    oauth_token        : accessToken,
    oauth_token_secret : accessTokenSecret,
    overwrite         : true,
    root: 'sandbox'
  };
  
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
