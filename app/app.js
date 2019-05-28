'use strict';

require('dotenv').config();

var favicon = require('serve-favicon');
var path = require('path');
var fs = require('fs');
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var url = require('url');
var multer = require('multer');
var csrf = require('csurf');

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
store.on('error', function(error, next){
	next(error)
});
mongoose.connect(process.env.MONGOURL, {useNewUrlParser: true})
.then(function(db){
	console.log('db connected')
})
.catch((err) => console.error.bind(console, 'connection error:'));

var cartRoutes = require('./cart/index');

var stripe = require("stripe")(
	process.env.NODE_ENV === 'production' ? 
	process.env.STORE_SECRET :
	process.env.STORE_SECRET_TEST
);

var port           = (process.env.NODE_ENV === 'production' ? 80 : 3111);
var uploadedPosts  = '../uploads/posts/';
var uploadedImages = '../uploads/img/';
var fUpload = multer();


var upload = multer({
  dest: uploadedImages 
}); 



app
.set('view engine', 'ejs');

app
.use(favicon(path.join(__dirname, 'public/img', 'favicon.ico')))
.use('/static',express.static(path.join(__dirname, 'public')))
.use('/uploadedImages',express.static(path.join(__dirname, uploadedImages)))
.use(bodyParser.json())
.use(function (req, res, next) {
  res.locals.session = req.session;
  if (req.url != '/') {
		var d = new Date().toLocaleString();
		console.log(req.url+" \n\t "+req.method+" \tIP: "+req.ip+"  \t"+d);
	}
  next();
})
.use(session({
	secret: process.env.SECRET,
	name: 'nodecookie',
	resave: true,
	saveUninitialized: true,
	store: store
}))
.use('/shop', cartRoutes);

app
.get('/b/*',(req, res, next) => {
	var fn = url.parse(req.url,true).pathname;
	fn = fn.replace('/b','');
	fs.readFile(uploadedPosts+fn,(err,data) => {
		if (!err) {
			res.render('pages/blog',JSON.parse(data.toString()));
		} else next();
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
	var popup = { 
		alertCart: (req.session && req.session.cart ? req.session.cart : null)
		}
		
	if (req.url == '/') res.render('pages/index',popup);
	else {
		fs.stat('views/pages'+req.url+'.ejs',(err,stats) => {
		if (err) {
			res.render('pages/error',popup);
			console.log("\t"+req.url+": error page returned");
		}
		else res.render('pages'+req.url, popup);
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





app
.listen(port, function () {
	console.log('Using Node Version: ' + process.version);
	(process.version == 'v10.15.3') ? console.log('..up-to-date') : console.log('expection v10.15.3');
	console.log('Web server listening on port: ' + port);
});
