var express = require('express');
var router = express.Router();
var multer = require('multer');
var upload = multer();
var fs = require('fs');

var uploadedPosts  = '../uploads/posts/';
var uploadedImages = '../uploads/img/';
const middleware = require('../utils/middleware');

var upload = multer({
  dest: uploadedImages 
}); 

router.param('id', middleware.ensureDocument);
router.all('*', middleware.ensureBlogData);
router.all('/edit', middleware.ensureAuthenticated);

router
.get('/:id',(req, res, next) => {
	res.render('pages/blog',JSON.parse(req.doc.toString()));
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
	
router
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
.post('/edit/createNew', (req, res) => {
	var fn = req.body.title.split(' ').join('_');
	fs.writeFile(uploadedPosts+fn,JSON.stringify(req.body),function(err){
		if(err) {res.render('pages/error');}
	});
	res.write(JSON.stringify({"fn":fn}));
	res.end();	
})
.post('/edit/loadFile', upload.single('file-to-upload'), (req, res) => {
	var fn = req.file.filename;
	fs.rename(uploadedImages+fn, uploadedImages+fn+'.jpg', function (err) {
		if (err) {res.render('pages/error');}
		fn += ".jpg";
		res.write(JSON.stringify({"fn":fn}));
		res.end();
	});
	
});

module.exports = router;