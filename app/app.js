'use strict';

require('dotenv').config();

var favicon = require('serve-favicon');
var path = require('path');
var fs = require('fs');
var bodyParser = require("body-parser");
//var cookieParser = require("cookie-parser");
//var url = require('url');
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
store.on('error', function(error, next){
	next(error)
});
mongoose.connect(process.env.MONGOURL, {useNewUrlParser: true})
.then(function(db){
	console.log('db connected')
})
.catch((err) => console.error.bind(console, 'connection error:'));

var cartRoutes = require('./cart/index');
var blogRoutes = require('./blog/index');

var stripe = require("stripe")(
	process.env.NODE_ENV === 'production' ? 
	process.env.STORE_SECRET :
	process.env.STORE_SECRET_TEST
);

var port           = (process.env.NODE_ENV === 'production' ? 80 : 3111);

var uploadedImages = '../uploads/img/';




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
.use('/shop', cartRoutes)
.use('/b', blogRoutes);

app
.get('/dstryCptlsm', (req, res) => {
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
.post('*',(req, res) => {
	console.log("\t"+req.url+": post not returned");
});

app
.listen(port, function () {
	console.log('Using Node Version: ' + process.version);
	(process.version == 'v10.15.3') ? console.log('..up-to-date') : console.log('expection v10.15.3');
	console.log('Web server listening on port: ' + port);
});
