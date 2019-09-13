const { Blog } = require('../models/index.js');
//const initData = require('./initBlog.json');
function ensureAdmin(req, res, next) {
	if (!req.isAuthenticated() || !req.user || !req.user.admin) {
		return res.redirect('/userinfo')
	} else {
		return next()
	} 
}
function ensureAuthenticated(req, res, next) {
	if (!req.isAuthenticated()) {
		return res.redirect('/userinfo')
	} else {
		req.session.user = req.user;
		return next()
	}
}
const ensureBlogDocument = async (req, res, next, val) => {
	const doc = await Blog.findById(val).lean().then((doc) => doc).catch((err) => next(err));
	if (!doc) {
		return next();
	} else {
		req.doc = doc;
		return next()
	}
}

function ensureBlogData(req, res, next) {
	Blog.find(req.blogQuery, (err, data) => {
		if (err) return next(err);
		req.featuredblogs = data;
		next();
	});
}

module.exports = { ensureAdmin, ensureAuthenticated, ensureBlogDocument, ensureBlogData }
