const { Blog } = require('../models/index.js');
const initData = require('./initBlog.json');
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
// TODO: there is currently only one document per-category, but later when blog fills up, we need to
// aggregate one document per category. See commented code below for failed attempt;
function aggregateData(distinct, cb) {
	Blog.find({}).lean().exec((err, data)=>{
		cb(err, data)
	})
	// var dat = [];
	// for (var i in distinct) {
	// 	var key = distinct[i];
	// 	Blog.findOne({category: key}).lean().exec((err, item) => {
	// 		// console.log(err)
	// 		// console.log(item)
	// 		// data.push(item)
	// 		dat[i] = item
	// 	})
	// 	if (i === (distinct.length-1)) {
	// 		cb(null, dat)
	// 	} else {
	// 		console.log(i)
	// 	}
	// }
	// await distinct.forEach(function(key, i){
	// 	Blog.findOne({category: key}).lean().exec((err, item) => {
	// 		// console.log(err)
	// 		// console.log(item)
	// 		// data.push(item)
	// 		dat[i] = item
	// 	})
	// 	//.catch((err) => null)
	// 	// if (doc) return doc;
	// }) 
	// console.log(dat)
	// if (dat.length === distinct.length) {
	// 	cb(null, dat)
	// } else if (dat.length > 0) {
	// 	cb(null, dat)
	// }
}

function ensureBlogData(req, res, next) {
	Blog.distinct('category', (err, distinct) => {
		if (err) return next(err);
		if (!distinct || distinct.length === 0) {
			
			var data = initData.map((doc) => {
				var entry = {
					title: 'About the '+doc.category+'',
					category: doc.category,
					description: doc.description,
					media: doc.media,
					tags: ['committee'],
					date: new Date()
				}
				var blog = new Blog(entry);
				blog.save((err) => console.log(err));
				return entry;
			});
			// data = await Blog.find({}).lean().then((data)=>data).catch((err)=>next(err));
			if (data && data.length > 0) req.featuredblogs = data;
			return next();

		} else {
			aggregateData(distinct, (err, data)=>{
				if (err) return next(err);
				if (data && data.length > 0) req.featuredblogs = data;
				return next();
			})
		}
	})
	// .catch((err) => next(err));
	

}
module.exports = { ensureAdmin, ensureAuthenticated, ensureBlogDocument, ensureBlogData }
