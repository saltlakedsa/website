var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
	cart: {type: Object, required: true},
	address: {type: String, required: true},
	city: {type: String, required: true},
	state: {type: String, required: true},
	zip: {type: String, required: true},
	name: {type: String, required: true},
	phone: {type: String, required: true},
	email: {type: String, required: true}
}, {collection: 'orders'});

module.exports = mongoose.model('Order', schema);