var express = require('express')
  , everyauth = require('everyauth')
  , conf = require('./conf')
  , request = require('request')
  , dbox = require('dbox')
  ;

everyauth.debug = true;

var usersById = {};
var nextUserId = 0;

function addUser (source, sourceUser) {
  var user;
  if (arguments.length === 1) { // password-based
    user = sourceUser = source;
    user.id = ++nextUserId;
    return usersById[nextUserId] = user;
  } else { // non-password-based
    user = usersById[++nextUserId] = {id: nextUserId};
    user[source] = sourceUser;
  }
  return user;
}

var usersByDropboxId = {};

everyauth.everymodule
  .findUserById( function (id, callback) {
    callback(null, usersById[id]);
  });

var _accessToken,
  _accessSecret;
  
everyauth
  .dropbox
    .consumerKey(conf.dropbox.consumerKey)
    .consumerSecret(conf.dropbox.consumerSecret)
    .findOrCreateUser( function (sess, accessToken, accessSecret, dropboxUserMetadata) {
      _accessToken = accessToken;
      _accessSecret = accessSecret;
      console.log('sess');
      console.dir( sess );
      //console.log('accessToken : ' + accessToken);
      //console.log('accessSecret : ' + accessSecret);
      return usersByDropboxId[dropboxUserMetadata.uid] ||
        (usersByDropboxId[dropboxUserMetadata.uid] = addUser('dropbox', dropboxUserMetadata));
    })
    .redirectPath('/')

var app = express.createServer();
app.configure( function () {
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'htuayrkjljeve' }));
  app.use(everyauth.middleware());
  app.use(express.methodOverride());
  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function (req, res) {
  res.render('index', {
    title: 'hoem'
  });
});

var client = dbox.createClient({
  app_key    : conf.dropbox.consumerKey,             // required
  app_secret : conf.dropbox.consumerSecret,           // required
  root       : "dropbox"            // optional (defaults to sandbox)
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
    root: 'sandbox'
  };
  
  client.mkdir("foo", options, function(status, reply){
    console.log(status)
    // 200
    console.log(reply)
    // {
    //   "size": "0 bytes",
    //   "rev": "1f477dd351f",
    //   "thumb_exists": false,
    //   "bytes": 0,
    //   "modified": "Wed, 10 Aug 2011 18:21:30 +0000",
    //   "path": "/foo",
    //   "is_dir": true,
    //   "icon": "folder",
    //   "root": "sandbox",
    //   "revision": 5023410
    // }
  });

  
  
  // var uri = 'https://api-content.dropbox.com/1';
  // var requestObj = {
  //   //url: uri + '/files/dropbox/hoge.txt',
  //   //url: 'https://api.dropbox.com/1/oauth/access_token',
  //   url: 'https://api.dropbox.com/1/account/info',
  //   oauth: {
  //     consumer_key: conf.dropbox.consumerKey,
  //     consumer_secret: conf.dropbox.consumerSecret,
  //     token: accessToken,
  //     token_secret: accessTokenSecret
  //   }
  // };
  
  // request.get(requestObj, function (error, response, body) {
  //   if (!error && response.statusCode == 200) {
  //     console.log('success');
  //     console.log(body) // Print the google web page.
  //   } else {
  //     console.log('error');
  //     //console.dir( error );
  //     console.dir( response );
  //     //console.dir( body );
  //   }
  // });
  res.json({
    hoge: 'hoge'
  });
});

everyauth.helpExpress(app);

app.listen(3000);

console.log('Go to http://local.host:3000');
