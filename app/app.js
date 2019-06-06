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
	new RegExp('production').test(process.env.NODE_ENV) ? 
	process.env.STORE_SECRET :
	process.env.STORE_SECRET_TEST
);

var port           = (new RegExp('production').test(process.env.NODE_ENV) ? 80 : 3111);
var uploadedPosts  = '../uploads/posts/';
var uploadedImages = '../uploads/img/';

const fUpload = multer();
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

const upload = multer({
  dest: uploadedImages 
}); 

var sess = {
	secret: process.env.SECRET,
	name: 'nodecookie',
	resave: true,
	saveUninitialized: true,
	store: store,
	cookie: { maxAge: 180 * 60 * 1000 }
}

var app = express();
app
.set('view engine', 'ejs');

const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });
const parseJSONBody = bodyParser.json();
const parseBody = [parseJSONBody, parseForm];


app
.use(favicon(path.join(__dirname, 'public/img', 'favicon.ico')))
.use('/static',express.static(path.join(__dirname, 'public')))
.use('/uploadedImages',express.static(path.join(__dirname, uploadedImages)))
// .use(bodyParser.json())
.use(cookieParser(sess.secret))
.use(session(sess))

.use(function (req, res, next) {
	if (req.url != '/') {
		console.log(req.url+" \n\t "+req.method+" \tIP: "+req.ip);
	}
	next();
})


app
.get('/', (req, res, next) => {
	console.log(req.session)
	return res.render('pages/index', { alertCart: (req.session && req.session.cart ? req.session.cart : null) });
})
.get('/b/*',(req, res, next) => {
	var fn = url.parse(req.url,true).pathname;
	fn = fn.replace('/b','');
	fs.readFile(uploadedPosts+fn,(err,data) => {
		if (err) {return next(err)}
		else {
			return res.render('pages/blog',JSON.parse(data.toString()));
		};
	});
})
.get('/getBlogList', (req, res, next) => {
	var fn = [];
	fs.readdir(uploadedPosts, async (err, files) => {
		if(err || (files == undefined)) {return next(err)}
		else {
			await files.forEach(file => {
				fn.push(file);
			});
			return res.status(200).send(JSON.stringify({"fn":fn}));
		}
		// res.end();
	});
}).get('/dstryCptlsm', (req, res, next) => {
	var Order = require('./models/order.js');
	Order.find({}).lean().exec(function(err, data){
		if (err) {
			return next(err);
		}
		return res.render('pages/list',{"data":data});
	});
})



app
.post('/isCredentials', parseBody, (req, res, next) => {
	var ret = {"isValid":null};
	fs.readFile('psdlist',(err,data) => {
		if (err) return next(err);
		var temp = JSON.parse(data.toString());
		if (req.body.password == temp[req.body.user]) {
			ret.isValid = true;
		} else ret.isValid = false;
		return res.status(200).send(JSON.stringify(ret));
	});
})
.post('/createNew', parseBody, async (req, res, next) => {
	var fn = req.body.title.split(' ').join('_');
	await fs.writeFile(uploadedPosts+fn,JSON.stringify(req.body),function(err){
		if(err) return next(err)
	});
	return res.status(200).send(JSON.stringify({"fn":fn}));
})
.post('/getBlogData', parseBody, (req, res, next) => {
	if (!req.body || req.body.fn) return res.status(200).send('')
	var fn = uploadedPosts+req.body.fn;
	fs.readFile(fn,(err,data) => {
		if (err) return next(err);
		if (data != undefined) {
			var retval = JSON.parse(data.toString());
			retval.fn = req.body.fn;
			return res.status(200).send(JSON.stringify(retval));
		}
	});
})
.post('/loadFile', upload.single('file-to-upload'), parseBody, (req, res, next) => {
	var fn = req.file.filename;
	fs.rename(uploadedImages+fn, uploadedImages+fn+'.jpg', function (err) {
		if (err) return next(err);
		fn += ".jpg";
		return res.status(200).send(JSON.stringify({"fn":fn}));
		// res.end();
	});
	
});

app.use(function (req, res, next) {
  res.locals.session = req.session;
  next();
});

app.get('/shop/checkout', csrfProtection)
app.post('/shop/checkout', fUpload.array(), parseBody, csrfProtection)
app.use('/shop', cartRoutes);

app.get(/^(?!\/shop)/, (req, res, next) => {
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
});

app.use(function (req, res, next) {
	if (req.url) console.log(require('url').parse(req.url).pathname)
	var err = new Error('Not Found');
	err.status = 404;
	return res.render('pages/error', {
		message: err.message,
		error: {}
	});
});

app.use(function (err, req, res) {
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
