'use strict';

require('dotenv').config();

var favicon = require('serve-favicon');
var path = require('path');
var fs = require('fs');
var bodyParser = require("body-parser");
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var urlparser = require('url');
var express = require('express');
var app = express();
var session = require('express-session');
var mongoose = require('mongoose');
var MongoDBStore = require('connect-mongodb-session')(session);
var cookieParser = require("cookie-parser");
var csrf = require('csurf'); 
var fUpload = require('multer')(); 

var cartRoutes = require('./cart/index');
var blogRoutes = require('./blog/index');

const stripe = require("stripe")(
	new RegExp('production').test(process.env.NODE_ENV) ? 
	process.env.STORE_SECRET :
	process.env.STORE_SECRET_TEST
);

var port           = (new RegExp('production').test(process.env.NODE_ENV) ? 80 : 3111);
var uploadedPosts  = '../uploads/posts/';
var uploadedImages = '../uploads/img/';
const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });
const parseJSONBody = bodyParser.json();
const parseBody = [parseJSONBody, parseForm];

var store = new MongoDBStore(
	{
		mongooseConnection: mongoose.connection,
		uri: process.env.MONGOURL,
		collection: 'shopSession'
		// ,
		// autoRemove: 'interval',     
		// autoRemoveInterval: 3600
	}
);
store.on('error', function(error){
	console.log(error);
});

var uri = process.env.MONGOURL;
var promise = mongoose.connect(uri, {useNewUrlParser: true});
promise.then(function(db){
	console.log('db connected')
})
.catch((err) => console.error.bind(console, ('connection error:'+ err)));

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

var sess = {
	secret: process.env.SECRET,
	name: 'nodecookie',
	resave: true,
	saveUninitialized: true,
	store: store,
	cookie: { maxAge: 180 * 60 * 1000 }
}


function logger(req, res, next) {
	
	var d = new Date().toLocaleString();
	var u = (req.user != null) ? req.user.username : "not logged in"; 
	console.log("\n\n"+req.url+" \n"+req.method+" \tIP: "+req.ip+"  \t"+d+" \tusr: "+u);
	console.log(req.session);
	//res.locals.session = req.session;
	next();
}

app
.set('view engine', 'ejs')
.use(favicon(path.join(__dirname, 'public/img', 'favicon.ico')))
.use('/static',express.static(path.join(__dirname, 'public')))
.use('/uploadedImages',express.static(path.join(__dirname, uploadedImages)))
.use(session(sess),
	passport.initialize(),
	passport.session(),
	// bodyParser.json(),
	// bodyParser.urlencoded({extended: true }),
	cookieParser(sess.secret),
	logger)
.use('/shop', cartRoutes)
.use('/b', blogRoutes)
.use('/a', adminRoutes)
.get('/logout', function(req, res){
  req.logout();
  res.redirect('/loggedin');
})
.get('/dstryCptlsm', (req, res, next) => {
	var Order = require('./models/order.js');
	Order.find({}).lean().exec(function(err, data){
		if (err) {
			next(err);
		}
		res.render('pages/list',{"data":data});
	});
})
.get(/^(?!\/shop|\/b\/.*|\/a\/.*)/, (req, res, next) => {
	console.log(req.url)
	fs.stat('views/pages'+req.url+'.ejs',(err,stats) => {
		if (err) {
			if (err.code === 'ENOENT') {
				err = new Error('Not Found');
				err.status = 404;
				return res.render('pages/error', {
					message: err.message,
					error: {}
				});
			} else {
				return next(err);
			}
		}
		else return res.render('pages'+req.url, { alertCart: (req.session && req.session.cart ? req.session.cart : null) });
	});
})
.post('/login',
  passport.authenticate('local', { failureRedirect: '/loggedin?authfail=true' }),
  function(req, res) { res.redirect('/loggedin');  })
.use(function (req, res, next) {
  res.locals.session = req.session;
  next();
})
.get('/shop/checkout', csrfProtection)
.post('/shop/checkout', fUpload.array(), parseBody, csrfProtection)
.use(function (req, res, next) {
	if (req.url) console.log(require('url').parse(req.url).pathname)
	var err = new Error('Not Found');
	err.status = 404;
	return res.render('pages/error', {
		message: err.message,
		error: {}
	});
})
.use(function (err, req, res, next) {
	console.log("!!!ERROR!!!")
	console.log(err)
	console.log("!!!ERROR!!!")
	res.status(err.status || 500);
	res.render('pages/error', {
		message: err.message,
		error: {}
	});
});


app
.listen(port, function () {
	console.log('Using Node Version: ' + process.version);
	(process.version == 'v10.15.3') ? console.log('..up-to-date') : console.log('expection v10.15.3');
	console.log('Web server listening on port: ' + port);
});
