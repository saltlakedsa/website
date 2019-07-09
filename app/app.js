'use strict';

require('dotenv').config();

var favicon = require('serve-favicon');
var path = require('path');
var fs = require('fs');
var bodyParser = require("body-parser");
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var SlackStrategy = require('passport-slack').Strategy;
var urlparser = require('url');
var express = require('express');
var app = express();
var session = require('express-session');
var mongoose = require('mongoose');
var MongoDBStore = require('connect-mongodb-session')(session);
var cookieParser = require("cookie-parser");
var csrf = require('csurf'); 
var fUpload = require('multer')(); 

const config = require('./utils/config.js');
const { ensureAdmin, ensureAuthenticated, ensureBlogDocument, ensureBlogData } = require('./utils/middleware.js');
const { adminRoutes, blogRoutes, cartRoutes } = require('./routes/index.js');
const { User } = require('./models/index.js');
const stripe = require("stripe")(
	new RegExp('production').test(config.env) ? 
	config.storeSecret :
	config.storeSecretTest
);

var port           = (new RegExp('production').test(config.env) ? 80 : 3111);
var uploadedPosts  = '../uploads/posts/';
var uploadedImages = '../uploads/img/';
const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });
const parseJSONBody = bodyParser.json();
const parseBody = [parseJSONBody, parseForm];

var store = new MongoDBStore(
	{
		mongooseConnection: mongoose.connection,
		uri: config.mongourl,
		// keeping as 'shopSession' even though it's the whole app's session
		collection: 'shopSession'
	}
);
store.on('error', function(error){
	console.log(error);
});

var uri = config.mongourl;
var promise = mongoose.connect(uri, {useNewUrlParser: true, useFindAndModify: false});
promise.then(function(db){
	console.log('db connected')
})
.catch((err) => console.error.bind(console, ('connection error:'+ err)));

passport.serializeUser(function(user, cb) {
  cb(null, user._id);
});
passport.deserializeUser(function(id, cb) {
  User.findById(id, function(err, user) {
		cb(err, user);
  });
});
passport.use(new LocalStrategy(User.authenticate()));
passport.use(new SlackStrategy({
	clientID: config.slackClientId,
	clientSecret: config.slackClientSecret
},
function(accessToken, refreshToken, profile, done) {
	User.findOne({ 'slack.oauthID': profile.user.id }).lean().exec(function(err, user) {
		if (err) {
			done(err);
		} else if (!err && user !== null) {
			done(null, user);
		} else {
			User.findOne({email: profile.user.email}).lean().exec(function(err, user) {
				if (err) {
					done(err);
				} else if (!err && user !== null) {
					// if the user registered previously via LocalStrategy, add the slack oauth id so that person may login with slack on the same user profile
					User.findOneAndUpdate({_id: user._id}, {$set:{'slack.oauthID': profile.user.id}}, {new:true,safe:true}, function(err, usr){
						if (err) {
							done(err)
						} else {
							done(null, usr);
						}
					})
				} else {
					console.log(profile)
					user = new User({
						username: profile.displayName.replace(/\s/g, '_'),
						email: profile.user.email,
						slack: {
							oauthID: profile.user.id
						},
						
						admin: (profile.team.domain === 'saltlakedsa'),
						date: new Date()
					});
					user.save(function(err) {
						done(err, user)
					});
				}
			})
		}
	});
}));

var sess = {
	secret: config.secret,
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
	// handle bodyParser separately to ensure it comes before csrfProtection
	cookieParser(sess.secret),
	logger)
.use(function (req, res, next) {
  res.locals.session = req.session;
  next();
})
.get('/', ensureBlogData)
.get('/committees', ensureBlogData)
.get('/logout', function(req, res){
  req.logout();
	req.session.destroy((err) => {
		if (err) {
			req.session = null;
		}
		res.redirect('/loggedin'); 
	})
})
.get('/auth/slack', passport.authenticate('slack'))
 
.get('/auth/slack/callback',
  passport.authenticate('slack', { failureRedirect: '/login' }),
  (req, res) => {
		req.session.user = req.user;
		return res.redirect('/loggedin');
})
.post('/checkauth/:email', async (req, res, next) => {
	var email = decodeURIComponent(req.params.email);
	console.log('this email: '+email)
	if (config.admin.split(',').indexOf(email) !== -1) {
		const user = await User.findOne({email: email}).lean().then((u) => u).catch((err)=>null);
		if (!user) {
			return res.status(200).send(true)
		} else {
			return res.status(200).send(user)
		}
	} else {
		return res.status(200).send(false)
	}
})
.get('/auth', csrfProtection)
.post('/auth', fUpload.array(), parseBody, csrfProtection, async (req, res, next) => {
	var admin;
	if (config.admin.split(',').indexOf(req.body.email.trim()) !== -1) {
		admin = true;
	} else {
		admin = false;
	}
	// console.log(admin)
	const existingUser = await User.findOne({email:req.body.email}).then((doc)=>doc).catch((err)=>next(err));
	console.log('existingUser')
	console.log(existingUser)
	var usr;
	if (!existingUser) {
		usr = new User(
			{ username : req.body.username, 
				email: req.body.email, 
				admin: admin,
				date: new Date()
			}
		)
		User.register(usr, req.body.password, (err, user) => {
			if (err) {
				return res.render('pages/auth', {info: "Sorry. That Name already exists. Try again."});
			}
			req.session.user = req.user;
			req.session.username = req.body.username;
			passport.authenticate('local', 
				{ successRedirect: '/loggedin', failureRedirect: '/loggedin?authfail=true' }
			)(req, res, function () {
				return res.redirect('/loggedin')
			})
				
		});
	} else {
		usr = existingUser;
		usr.setPassword(req.body.password, function(err,user){
			if (err) {
				return next(err)
			} else { 
				user.save((err)=>next(err));
				req.session.user = user;
				req.session.username = user.username;
				return res.redirect('/loggedin')
			}
		})
	}
	
})
.get('/login', csrfProtection)
.post('/login', fUpload.array(), parseBody, csrfProtection, 
  passport.authenticate('local', { successRedirect: '/loggedin', failureRedirect: '/login?authfail=true' }),
	function(req, res, next){
		req.session.user = req.user;
		res.redirect('/loggedin')
	})

// .get('/shop/checkout', csrfProtection)
// .post('/shop/checkout', fUpload.array(), parseBody, csrfProtection)
.use('/shop', cartRoutes)
// .get('/cms/*', csrfProtection)
// .post('/cms/*', )
.use('/b', blogRoutes)
.use('/a', adminRoutes)
.get('/loggedin', csrfProtection)
.post('/loggedin', fUpload.array(), parseBody, csrfProtection, (req, res, next) => {
	User.findOneAndUpdate({_id:req.session.user._id}, {$set:{about:req.body.about}}, {new:true}).lean().exec((err, user)=>{
		if (err) {
			return next(err)
		} else {
			req.session.user = user;
			return res.redirect('/loggedin')
		}
	})
})
.get(/^(?!\/shop|\/cms\/.*|\/b\/.*|\/a\/.*)/, (req, res, next) => {
	var url = req.url.split('?')[0];
	if (url === '/') {
		url = '/index'
	};
	fs.stat('views/pages'+url+'.ejs',(err,stats) => {
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
		} else {
			// console.log(req.featuredblogs)
			return res.render('pages'+url, { 
				isUser: (!req.query.u && !req.query.e ? false : true),
				username: (!req.query && !req.query.u ? '' : decodeURIComponent(req.query.u)),
				email: (!req.query && !req.query.e ? '' : decodeURIComponent(req.query.e)),
				user: (!req.user ? req.session.user : req.user),
				csrfToken: (typeof req.csrfToken === 'function' ? req.csrfToken() : null),
				data: req.featuredblogs,
				vData: JSON.stringify(req.featuredblogs),
				alertCart: (req.session && req.session.cart ? req.session.cart : null) 
			});
		}
	});
})
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
