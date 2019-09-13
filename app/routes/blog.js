
const adminRoutes = require('./admin.js');
const express = require('express');
const router = express.Router();
var multer = require('multer');

const fs = require('fs');
const sharp = require('sharp');
const config = require('../utils/config.js');
var uploadedImages = config.mount_path;
var upload = multer({ dest: uploadedImages});
const { ensureAdmin, ensureAuthenticated, ensureBlogDocument, ensureBlogData } = require('../utils/middleware.js');
const { User, Blog } = require('../models/index.js');
const marked = require('marked');
const bodyParser = require("body-parser");
const csrf = require('csurf'); 
const csrfProtection = csrf({ cookie: true });
//const parseForm = bodyParser.urlencoded({ extended: false });
//const parseJSONBody = bodyParser.json();
//const parseBody = [parseJSONBody, parseForm];
const mkdirp = require('mkdirp');
const path = require('path');


var curly = function(str){
	if (!str || typeof str.replace !== 'function'){
		return ''
	} else {
		return str
		.replace(/(\s)'(\w)/g,'$1&lsquo;$2')
		.replace(/(\w)'(\s)/g,'$1&rsquo;$2')
		.replace(/(\s)"(\w)/g,'$1&ldquo;$2')
		.replace(/(\w)"(\s)/g,'$1&rdquo;$2')
		.replace(/(\w\.)"/g, "$1&rdquo;")     // Closing doubles
		.replace(/\u2018/g, "&lsquo;")
		.replace(/\u2019/g, "&rsquo;")
		.replace(/\u201c/g, "&ldquo;")
		.replace(/\u201d/g, "&rdquo;")
		.replace(/[“]/g, "&ldquo;")
		.replace(/[”]/g, "&rdquo;")
		.replace(/[’]/g, "&rsquo;")
		.replace(/[‘]/g, "&lsquo;")
		.replace(/([a-z])&lsquo([a-z])/ig, '$1&rsquo;$2')
	}
}


var storage = multer.diskStorage({
	destination: async (req, file, cb) => {
		var p = uploadedImages + req.params.bid;
		console.log(p);
		var exists = await fs.existsSync(p);
		if (!exists) {
			mkdirp(p, (err) => {
				if (err) {
					cb(err)
				} else {
					cb(null, p)
				}
			})
		} else {
			cb(null, p)
		}
  },
	filename: (req, file, cb) => {
		var newPath = file.originalname.replace(/\.(tiff|jpg|jpeg)$/, '.png');
		cb(null, newPath) //Appending extension
	}
});

var uploadmedia = multer({ storage: storage });





router
.all('/edit/*', adminRoutes)
.get('/*/:bid', (req, res, next) => {
	req.parsedURL.pathname = req.parsedURL.pathname.replace(req.params.bid,''); // remove bid
	if (req.params.bid === 'new') {
		const doc = new Blog({
			author: req.user._id,
			lede: "type here",
			type: "type here",
			title: "type here",
			category: "blog",
			description: "type here",
			date: new Date(),
			media: "",
			tags: ""
		});
		req.doc = doc;
		next();
	} else {
		Blog.findById(req.params.bid).lean().exec((err, doc) => {
			if (err) { 
				return next(err); 
			} 
			else {
				//console.log('found it')
				req.doc = doc;
				next();
			}
		})
	}
	
})
.get('/edit/:bid', csrfProtection, async (req, res, next) => {
	//req.parsedURL.pathname = req.parsedURL.pathname.replace(req.params.bid,'');
	if (req.params.bid === 'new') {
		const newBlog = new Blog({
			author: req.user._id,
			lede: "type here",
			type: "type here",
			title: "type here",
			category: "type here",
			description: "type here",
			date: new Date(),
			media: "",
			tags: ""
		});
		req.vDoc = JSON.stringify(newBlog);
		next();
	} else {
		const doc = await Blog.findById(req.params.bid).lean().then((doc) => doc).catch((err) => next(err));
		/** what is this?
		let author;
		if (doc) author = await User.findById(doc.author).lean().then((author) => author).catch((err) => next(err));
		**/
		req.vDoc = JSON.stringify(doc);
		next();
	}
})

/**
// parseBody
.post('/edit/createNew', upload.array(), csrfProtection, (req, res) => {
	var media = req.body.media || []
	const post = new Blog({
		author: req.user._id,
		lede: req.body.lede,
		type: req.body.type,
		title: req.body.title,
		category: req.body.category,
		description: req.body.description,
		date: new Date(),
		media: media,
		tags: req.body.tags
  });
	post.save((err) => {
		if (err) return next(err)
	});
	return res.redirect('/b/'+post._id);
})
**/
//.post('/edit/:bid', upload.array(), parseBody, csrfProtection, (req, res, next) => {
	
/**
.post('/edit/:bid', bodyParser.urlencoded({ extended: true }), (req, res, next) => {
	 res.send('You sent the name "' + JSON.stringify(req.body) + '".');
	 })
----
	
	/**
	
	**/

// todo add csrfToken to ajax formData in the createpost.ejs Vue instance
// was using parseBody
.post('/edit/:bid',
	upload.single('newimg'),
	bodyParser.urlencoded({ extended: true }), 
	(req, res, next) => {
	if (req.params.bid === 'uploadimg') {
		console.log('uploading image');
		console.log(req.file.filename);
		var fn = req.file.filename;
		fs.rename(uploadedImages+fn, uploadedImages+fn+'.jpg', function (err) {
			if (err) {console.log('error renaming');}
			fn += ".jpg";
			res.write(JSON.stringify({"fn":fn}));
			res.end();
		});
	} else {
		
		//res.send('You sent the name: "' + JSON.stringify(req.body) + '".');
		//res.end();
		
		Blog.findOne({_id: req.params.bid}, async (err, doc) => {
		if (doc==null) {
			var doc=new Blog //create new blog
		};
		console.log(JSON.stringify(req.body));
		var keys = Object.keys(req.body);
		await keys.forEach((key) => {
			if (key !== 'media') {
				doc[key] = req.body[key]
			} else {
				doc.media[0] = {"image":req.body.media,"caption":req.body.caption};
				/**
				doc.media.forEach((item, i) => {
					
					var ks = Object.keys(req.body.media[i]);
					ks.forEach((k) => {
						doc.media[i][k] = req.body.media[i][k]
					})
					
				})
				**/
			}
		});
		var d = new Date();
		doc.date = d.toString();
		var cleanupDescription = marked(curly(doc.description));
		doc.description = cleanupDescription;
		if (req.user) doc.author = req.user._id;
		doc.save((err) => {
			if (err) {
				return next(err)
			} else {
				return res.redirect('/b/view/'+doc._id);
			}
		})
	})
		
	}
})
	/*const imagePath = req.file.path;
	const thumbPath = req.file.path.replace(/\.(png)$/, '.thumb.png');
	sharp(req.file.path).resize({ height: 200 }).toFile(thumbPath)
	.then(function(newFileInfo) {
		console.log("resize success")
		console.log(newFileInfo)
	})
	.catch(function(err) {
		console.log("resize error occured");
		console.log(err)
	});
	*/
	
	
	
	/**
	const media = {
		image: '/uploadedImages/'+req.params.bid+'/'+req.file.filename,
		//image_abs: req.file.path,
		//thumb: '/uploadedImages/'+req.params.bid+'/'+req.file.filename.replace(/\.(png)$/, '.thumb.png'),
		//thumb_abs: thumbPath,
		caption: req.param('caption')
	}
	Blog.findOne({_id: req.params.bid}, (err, doc) => {
		console.log(doc['media'][0]._id);
		doc['media'] = media;
		doc.save(function(err){
			if (err) {
			return next(err)
		} else {
			console.log(err);
			return res.status(200).send(doc)
		}
		});
	})
	/*
	Blog.findOne({_id: req.params.bid}, {$push: {media: media}}, {safe: true, upsert: false, new: true}, (err, doc) => {
		if (err) {
			return next(err)
		} else {
			console.log(err);
			return res.status(200).send(doc)
		}
	})
	*/
	/*
	console.log(media.image);
	scpclient.scp(__dirname+'/../../uploads/img/' +req.params.bid+'/'+req.file.filename,'root:rosawas#1@45.79.98.14:/mnt/web_images/img/'+media.image,function(err){
		
		console.log(err);
		fs.unlink(__dirname+'/../../uploads/img/' +req.params.bid+'/'+req.file.filename, (err) => {
			if (err) {
				console.error(err)
			return
			}
		})
	});
	*/

.post('/edit/deleteentry/:bid', async function(req, res, next) {
	var outputPath = url.parse(req.url).pathname;
	console.log(outputPath)
	var id = req.params.bid;
	Blog.findById(id).lean().exec(async (err, doc) => {
		if (err) {
			return next(err)
		}
		var item = doc.media[0]
		var existsImg = await fs.existsSync(item.image_abs);
		if (existsImg) {
			var p = (path.join(__dirname, uploadedImages) + id);
			await fs.rmdirSync(p);
		}
		return res.status(200).send('ok');
	})
})
.post('/edit/deletemedia/:bid/:index', function(req, res, next) {
	var id = req.params.bid;
	var index = parseInt(req.params.index, 10);
	Blog.findOne({_id: id}).lean().exec(async function(err, thisdoc){
		if (err) {
			return next(err)
		}
		var oip = (!thisdoc.media[index] || !thisdoc.media[index].image_abs ? null : thisdoc.media[index].image_abs);
		var otp = (!thisdoc.media[index] || !thisdoc.media[index].thumb_abs ? null : thisdoc.media[index].thumb_abs);
		var existsImg = await fs.existsSync(oip);
		var existsThumb = await fs.existsSync(otp);
		if (existsImg) await fs.unlinkSync(oip);
		if (existsThumb) await fs.unlinkSync(otp);
		Blog.findOneAndUpdate({_id: id}, {$pull: {media: {_id: thisdoc.media[index]._id}}}, {multi: false, new: true}, function(err, doc) {
			if (err) {
				return next(err) 
			}
			return res.status(200).send(doc);
		})	
	})
});

module.exports = router;