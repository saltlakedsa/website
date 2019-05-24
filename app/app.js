'use strict';

var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');
var fs = require('fs');
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var url = require('url');
const multer = require('multer');
const dotenv = require('dotenv');
const csrf = require('csurf');  
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const cartRoutes = require('./cart/index');
// mongoose.Promise = promise;

dotenv.load();

const stripe = require("stripe")(
	process.env.NODE_ENV === 'production' ? 
	process.env.STORE_SECRET :
	process.env.STORE_SECRET_TEST
);

var port           = (process.env.NODE_ENV === 'production' ? 80 : 3111);
var uploadedPosts  = '../uploads/posts/';
var uploadedImages = '../uploads/img/';

const fUpload = multer();

const upload = multer({
  dest: uploadedImages 
}); 

var app = express();
app.use(favicon(path.join(__dirname, 'public/img', 'favicon.ico')));

var store = new MongoDBStore(
	{
		mongooseConnection: mongoose.connection,
		uri: process.env.MONGOURL,
		collection: 'shopSession',
		autoRemove: 'interval',     
		autoRemoveInterval: 3600
	}
)
store.on('error', function(error, next){
	next(error)
});

var sess = {
	secret: process.env.SECRET,
	name: 'nodecookie',
	resave: true,
	saveUninitialized: true,
	store: store
	// ,
  // cookie: { maxAge: 180 * 60 * 1000 }
}
// app.use(cookieParser(sess.secret));
app.use(function (req, res, next) {
  res.locals.session = req.session;
  next();
})

app
.use('/static',express.static(path.join(__dirname, 'public')))
.use('/uploadedImages',express.static(path.join(__dirname, uploadedImages)))
.use(bodyParser.json());

app
.set('view engine', 'ejs');

const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });
const parseJSONBody = bodyParser.json();
const parseBody = [parseJSONBody, parseForm];
app.use(session(sess));
// TODO get this working (csrf)
// app.get(/^(\/shop\/checkout$)/, csrfProtection);
// // ensure multer parses before csrf
// app.post(/^(\/shop\/checkout$)/, fUpload.array(), parseBody, csrfProtection);

app.use('/shop', cartRoutes);

app
.get('/', (req, res) => {
	res.render('pages/index', { alertCart: (req.session && req.session.cart ? req.session.cart : null) });
})
.get('/b/*',(req, res) => {
	var fn = url.parse(req.url,true).pathname;
	fn = fn.replace('/b','');
	fs.readFile(uploadedPosts+fn,(err,data) => {
		if (err) {res.render('pages/error');}
		else {
			res.render('pages/blog',JSON.parse(data.toString()));
			};
	});
})
.get('/getBlogList', (req, res) => {
	var fn = [];
	fs.readdir(uploadedPosts, (err, files) => {
		if(err || (files == undefined)) {res.render('pages/error');}
		else {
			files.forEach(file => {
				fn.push(file);
			});
			res.write(JSON.stringify({"fn":fn}));
		}
		res.end();
	});
}).get('/dstryCptlsm', (req, res) => {
	var Order = require('./models/order.js');
	Order.find({}).lean().exec(function(err, data){
		res.render('pages/list',{"data":data});
	});
})
.get('*', (req, res) => {
	fs.stat('views/pages'+req.url+'.ejs',(err,stats) => {
		if (err) res.render('pages/error');
		else res.render('pages'+req.url, { alertCart: (req.session && req.session.cart ? req.session.cart : null) });
	});
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
.post('/createNew', (req, res) => {
	var fn = req.body.title.split(' ').join('_');
	fs.writeFile(uploadedPosts+fn,JSON.stringify(req.body),function(err){
		if(err) {res.render('pages/error');}
	});
	res.write(JSON.stringify({"fn":fn}));
	res.end();	
})
.post('/getBlogData', (req,res) => {
	var fn = uploadedPosts+req.body.fn;
	fs.readFile(fn,(err,data) => {
		if (err) {res.render('pages/error');}
		if (data != undefined) {
			var retval = JSON.parse(data.toString());
			retval.fn = req.body.fn;
			res.write(JSON.stringify(retval));
		}
		res.end();
	});
})
.post('/loadFile', upload.single('file-to-upload'), (req, res) => {
	var fn = req.file.filename;
	fs.rename(uploadedImages+fn, uploadedImages+fn+'.jpg', function (err) {
		if (err) {res.render('pages/error');}
		fn += ".jpg";
		res.write(JSON.stringify({"fn":fn}));
		res.end();
	});
	
});

app.use(function (err, req, res) {
	var url = require('url').parse(req.url).pathname;
	console.log('error route: ');
	console.log(url);
	res.status(err.status || 500);
	res.render('pages/error', {
		message: err.message,
		error: {}
	});
});

var uri = process.env.MONGOURL;

var promise = mongoose.connect(uri, {useNewUrlParser: true});
promise.then(function(db){
	console.log('db connected')
})
.catch((err) => console.error.bind(console, 'connection error:'));

app
.listen(port, function () {
	console.log('Using Node Version: ' + process.version);
	(process.version == 'v10.15.3') ? console.log('..up-to-date') : console.log('expection v10.15.3');
	console.log('Web server listening on port: ' + port);
});
