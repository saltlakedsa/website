const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const fs = require('fs');
const sharp = require('sharp');
const config = require('../utils/config.js');
var uploadedPosts  = '../../uploads/posts/';
var uploadedImages = '../../uploads/img/';
// const uploadedPosts  = (config.env === 'production' ? config.uploadedFiles : config.uploadedFilesDev);
// const uploadedImages = (config.env === 'production' ? config.uploadedImages : config.uploadedImagesDev);
const { ensureAdmin, ensureAuthenticated, ensureBlogDocument, ensureBlogData } = require('../utils/middleware.js');
const { User, Blog } = require('../models/index.js');
const marked = require('marked');
const bodyParser = require("body-parser");
const csrf = require('csurf'); 
const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });
const parseJSONBody = bodyParser.json();
const parseBody = [parseJSONBody, parseForm];
const mkdirp = require('mkdirp');
const path = require('path');
// typographer's quotes
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
		var p = (path.join(__dirname, uploadedImages) + req.params.bid);
		var exists = await fs.existsSync(p);//.catch((err) => console.log(err));
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
})

var uploadmedia = multer({ storage: storage });

// router.param('bid', ensureBlogDocument);
// router.all('/*', middleware.ensureBlogData);
router.all('/edit', ensureAuthenticated);

router
.get('/:bid', (req, res, next) => {
	// console.log(req.doc)
	// const doc = await Blog.findById(req.params.bid).lean().then((doc) => doc).catch((err) => console.log(err))
	// console.log(doc)
	Blog.findById(req.params.bid).lean().exec((err, doc) => {
		if (err) {
			return next(err)
		}
		if (doc && doc.author) {
			User.findById(doc.author).lean().exec((err, author) => {
				if (err) {
					console.log(err)
				} else {
					return res.render('pages/blog', {
						user: (!req.user ? req.session.user : req.user),
						doc: doc,//JSON.parse(JSON.stringify(doc)),//JSON.stringify(doc),
						vDoc: JSON.stringify(doc),
						author: author
				  });
				}
			})
		} else {
			// console.log(doc)
			return res.render('pages/blog', {
				user: (!req.user ? req.session.user : req.user),
				vDoc: JSON.stringify(doc),
				doc: doc//JSON.parse(JSON.stringify(doc))//JSON.stringify(doc)
			});
		}
	})
	
})
.get('/', ensureBlogData, (req, res, next) => {
	// const data = Blog.find({}).lean().exec((data) => data).catch((err) => next(err));
  return res.render('pages/blogRoll', {
		data: req.featuredblogs,
		vData: JSON.stringify(req.featuredblogs)
  })
})
.post('/edit/createNew', upload.array(), parseBody, csrfProtection, (req, res) => {
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
.get('/edit/:bid', csrfProtection, async (req, res, next) => {
	const doc = await Blog.findById(req.params.bid).lean().then((doc) => doc).catch((err) => next(err));
	let author;
	if (doc) author = await User.findById(doc.author).lean().then((author) => author).catch((err) => next(err));
	res.render('pages/createpost', {
		doc: doc,
		vDoc: JSON.stringify(doc),
		csrfToken: req.csrfToken(),
		user: req.user,
		author: author,
		edit: true
	});
})
.post('/edit/:bid', upload.array(), parseBody, csrfProtection, (req, res, next) => {
	Blog.findOne({_id: req.params.bid}, async (err, doc) => {
		var keys = Object.keys(req.body);
		await keys.forEach((key) => {
			if (key !== 'media') {
				doc[key] = req.body[key]
			} else {
				doc.media.forEach((item, i) => {
					var ks = Object.keys(req.body.media[i]);
					ks.forEach((k) => {
						doc.media[i][k] = req.body.media[i][k]
					})
				})
			}
		});
		var cleanupDescription = marked(curly(doc.description));
		doc.description = cleanupDescription;
		if (req.user) doc.author = req.user._id;
		doc.save((err) => {
			if (err) {
				return next(err)
			} else {
				return res.redirect('/b/'+doc._id);
			}
		})
	})
})
// todo add csrfToken to ajax formData in the createpost.ejs Vue instance
.post('/edit/uploadimg/:bid', uploadmedia.single('img'), parseBody/*, csrfProtection*/, (req, res, next) => {
	const imagePath = req.file.path;
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
	const media = {
		image: '/uploadedImages/'+req.params.bid+'/'+req.file.filename,
		image_abs: req.file.path,
		thumb: '/uploadedImages/'+req.params.bid+'/'+req.file.filename.replace(/\.(png)$/, '.thumb.png'),
		thumb_abs: thumbPath,
		caption: 'Edit me'
	}
	Blog.findOneAndUpdate({_id: req.params.bid}, {$push: {media: media}}, {safe: true, upsert: false, new: true}, (err, doc) => {
		if (err) {
			return next(err)
		} else {
			return res.status(200).send(doc)
		}
	})
})
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