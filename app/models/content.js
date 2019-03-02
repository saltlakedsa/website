var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var Content = new Schema({
	title: String,
	description: String,
	time: {
		begin: Date,
		end: Date
	},
	price: Number,
	image: String
}, {collection: 'inventory'});

module.exports = mongoose.model('Content', Content);