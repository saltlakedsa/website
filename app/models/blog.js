var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var Media = new Schema({
	caption: String,
	image: String,
	image_abs: String,
	thumb: String,
	thumb_abs: String,
	iframe: String,
});

var Blog = new Schema({
	type: String,
	title: String,
	author: String,
	category: String,
	lede: String,
	description: String,
	date: Date,
	media: [Media],
	tags: [String]
}, {collection: 'blog'});

module.exports = mongoose.model('Blog', Blog);