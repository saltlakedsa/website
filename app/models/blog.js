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
	title: String,
	committee: String,
	description: String,
	time: {
		begin: Date,
		end: Date
	},
	media: [Media]
}, {collection: 'blog'});

module.exports = mongoose.model('Blog', Blog);