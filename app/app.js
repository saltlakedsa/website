'use strict';

var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');
var fs = require('fs');
var bodyParser = require("body-parser");
var url = require('url');
const multer = require('multer');

var port           = 80;
var uploadedPosts  = '../uploads/posts/';
var uploadedImages = '../uploads/img/';

const upload = multer({
  dest: uploadedImages 
}); 

var app = express();
app.use(favicon(path.join(__dirname, 'public/img', 'favicon.ico')));


app
.use('/static',express.static(path.join(__dirname, 'public')))
.use('/uploadedImages',express.static(path.join(__dirname, uploadedImages)))
.use(bodyParser.json());

app
.set('view engine', 'ejs');

app
.get('/', (req, res) => {
	res.render('pages/index');
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
})
.get('*', (req, res) => {
	fs.stat('views/pages'+req.url+'.ejs',(err,stats) => {
		if (err) res.render('pages/error');
		else res.render('pages'+req.url);
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


app
.listen(port, function () {
	console.log('Web server listening on port: ' + port)
});
