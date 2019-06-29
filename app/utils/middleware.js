const { Blog } = require('../models/index.js');
const { initData } = require('./initBlog.json');

module.exports = {
	ensureAdmin: (req, res, next) => {
		if (!req.isAuthenticated() || !req.user || !req.user.admin) {
			return res.redirect('/login')
		} else {
			return next()
		} 
	},
	ensureAuthenticated: (req, res, next) => {
		if (!req.isAuthenticated()) {
			return res.redirect('/login')
		} else {
			return next()
		}
	},
	ensureBlogDocument: async (req, res, next) => {
		const doc = await Blog.findOne({_id: req.params.id}).lean().then((doc) => doc).catch((err) => next(err));
		if (!doc) {
			return next('route');
		} else {
			req.doc = doc;
			return next()
		}
	},
	ensureBlogData: async (req, res, next) => {
		const data = await Blog.find({}).lean().then((data)=>data).catch((err)=>next(err));
		if (!data) {
			await initData.forEach((doc) => {
				var blog = new Blog({
					committee: doc.committee,
					description: doc.description,
					media: doc.media
				});
				blog.save((err) => next(err));
			});
			const data = await Blog.find({}).lean().then((data)=>data).catch((err)=>next(err));
			if (data && data.length > 0) req.data = data;
			return next();
		}
	}
}