var express = require('express');
var router = express.Router();
var dotenv = require('dotenv');
var User = require('../models/user.js');
var multer = require('multer');
var upload = multer();
var url = require('url');
const bodyParser = require("body-parser");
const csrf = require('csurf'); 
const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });
const parseJSONBody = bodyParser.json();
const parseBody = [parseJSONBody, parseForm];
const { ensureAdmin, ensureAuthenticated } = require('../utils/middleware.js');
dotenv.load();

router
.all('/*', ensureAdmin)
.get('/dstryCptlsm', (req, res, next) => {
	var Order = require('../models/order.js');
	Order.find({}).lean().exec(function(err, data){
		if (err) {
			next(err);
		}
		res.render('pages/list',{"data":data});
	});
})




module.exports = router;