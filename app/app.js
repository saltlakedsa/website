'use strict';

require('dotenv').config();

var favicon = require('serve-favicon');
var path = require('path');
var fs = require('fs');
var bodyParser = require("body-parser");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
//var cookieParser = require("cookie-parser");
var urlparser = require('url');
//var multer = require('multer');
//var csrf = require('csurf');

var express = require('express');
var app = express();
var session = require('express-session');
var mongoose = require('mongoose');
var MongoDBStore = require('connect-mongodb-session')(session);
var store = new MongoDBStore(
	{
		mongooseConnection: mongoose.connection,
		uri: process.env.MONGOURL,
		collection: 'shopSession',
		autoRemove: 'interval',     
		autoRemoveInterval: 3600
	}
);
store.on('error', function(error){
	console.log(error);
});
mongoose.connect(process.env.MONGOURL, {useNewUrlParser: true})
.then(function(db){
	console.log('db connected')
})
.catch((err) => console.error.bind(console, 'connection error:'));


const Schema = mongoose.Schema;
const UserDetail = new Schema({
      username: String,
      password: String
    },{collection: 'userInfo'});
const UserDetails = mongoose.model('userInfo', UserDetail, 'userInfo');



//setting up database
UserDetails.find({}).lean().exec(function(err, data){
		if (err) {
			console.log("eeerrrorr");
		}
		if (data.length === 1) {
			var item = new UserDetails({
				username: 'admin',
				password: 'password'
				});
			item.save(function(err){
				if (err) {
					console.log("eeerrrorr");
				}
			})
			var item2 = new UserDetails({
				username: 'admin2',
				password: 'password'
				});
			item2.save(function(err){
				if (err) {
					console.log("eeerrrorr");
				}
			})
		}
});


var cartRoutes = require('./cart/index');
var blogRoutes = require('./blog/index');

var stripe = require("stripe")(
	process.env.NODE_ENV === 'production' ? 
	process.env.STORE_SECRET :
	process.env.STORE_SECRET_TEST
);

var port           = (process.env.NODE_ENV === 'production' ? 80 : 3111);

var uploadedImages = '../uploads/img/';



passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});


passport.deserializeUser(function(id, cb) {

  UserDetails.findById(id, function(err, user) {
    cb(err, user);
  });
 
});


passport.use(new LocalStrategy(
  function(username, password, done) {
      UserDetails.findOne({
        username: username
      }, function(err, user) {
        if (err) {
          return done(err);
        }

        if (!user) {
          return done(null, false);
        }

        if (user.password != password) {
          return done(null, false);
        }
        return done(null, user);
      });
  }
));

app
.set('view engine', 'ejs');

app
.use(session({
	secret: process.env.SECRET,
	name: 'nodecookie',
	resave: true,
	saveUninitialized: true,
	store: store
}))
.use(passport.initialize())
.use(passport.session())
.use(favicon(path.join(__dirname, 'public/img', 'favicon.ico')))
.use('/static',express.static(path.join(__dirname, 'public')))
.use('/uploadedImages',express.static(path.join(__dirname, uploadedImages)))
.use(bodyParser.json())
.use(bodyParser.urlencoded({extended: true }))
.use(function (req, res, next) {
  res.locals.session = req.session;
  //console.log(req.session);
  if (req.url != '/') {
		var d = new Date().toLocaleString();
		var u = (req.user != null) ? req.user.username : "not logged in"; 
		console.log(req.url+" \n\t "+req.method+" \tIP: "+req.ip+"  \t"+d+" \tusr: "+u);
	}
  next();
})

.use('/shop', cartRoutes)
.use('/b', blogRoutes)



//app
//app.get('/success', (req, res) => res.send("Welcome "+req.query.username+"!!"))
//app.get('/error', (req, res) => res.send("error logging in"))
app
.get('/logout', function(req, res){
  req.logout();
  res.redirect('/loggedin');
})
.get('/dstryCptlsm', (req, res) => {
	var Order = require('./models/order.js');
	Order.find({}).lean().exec(function(err, data){
		res.render('pages/list',{"data":data});
	});
})
.get('*', (req, res) => {
	var pathURL = urlparser.parse(req.url,true);
	
	var popup = { 
		alertCart: (req.session && req.session.cart ? req.session.cart : null),
		user: req.user,
		parameters: pathURL.query
	}
	console.log(popup);
		
	if (req.url == '/') res.render('pages/index',popup);
	else {
		fs.stat('views/pages'+pathURL.pathname+'.ejs',(err,stats) => {
		if (err) {
			res.render('pages/error',popup);
			console.log("\t"+req.url+": error page returned");
		}
		else res.render('pages'+pathURL.pathname, popup);
	});
	}
});

app
.post('/isCredentials', (req, res) => {
	var ret = {"isValid":null};
	fs.readFile('psdlist',(err,data) => {
		var temp = JSON.parse(data.toString());
		if (req.body.password == temp[req.body.user]) {
			ret.isValid = true;
		} else ret.isValid = false;
		res.write(JSON.stringify(ret));
	res.end();
	});
})
.post('/login',
  passport.authenticate('local', { failureRedirect: '/loggedin?authfail=true' }),
  function(req, res) {
    //res.redirect('/success?username='+req.user.username);
	res.redirect('/loggedin');
  })
.post('*',(req, res) => {
	console.log("\t"+req.url+": post not returned");
});

app
.listen(port, function () {
	console.log('Using Node Version: ' + process.version);
	(process.version == 'v10.15.3') ? console.log('..up-to-date') : console.log('expection v10.15.3');
	console.log('Web server listening on port: ' + port);
});
