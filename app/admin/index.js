var express = require('express');
var router = express.Router();
var dotenv = require('dotenv');
var User = require('../models/user.js');
var multer = require('multer');
var upload = multer();
var url = require('url');
dotenv.load();

router
.post('/newUser', (req, res, next) => {
	var user = new UserDetails({
		username: req.body.username,
		password: req.body.password,
		admin: false,
	});
	user.save(function(err){
		if (err) {console.log("Error adding new user");}
			})
		res.redirect('/loggedin');
})


module.exports = router;