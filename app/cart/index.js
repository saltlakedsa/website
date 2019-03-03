var express = require('express');
var router = express.Router();
var dotenv = require('dotenv');
var Content = require('../models/content.js');
var Cart = require('../models/cart.js');
var Order = require('../models/order.js');
var multer = require('multer');
var upload = multer();
dotenv.load();

// router.get('/addtoinventory/:item', function(req, res, next) {
// 
// })

router.get('/logout', function(req, res, next){
	req.session.destroy(function(err){
		if (err) {
			req.session = null;
			//improve error handling
			
		} else {
			req.session = null;
		}
		next(null)
	});	
})

router.get('/inventory', function(req, res, next) {
	Content.find({}).lean().exec(function(err, data){
		if (err) {
			return next(err)
		}
		if (data.length === 0) {
			var item = new Content({
				title: 't-shirt',
				description: 'Red shirt with full-color DSA SLC artwork',
				time: {
					begin: new Date(),
					end: new Date()
				},
				price: 2000,
				image: '/static/img/shop/DSA-Red.jpg'
			})
			item.save(function(err){
				if (err) {
					return next(err)
				}
			});
			data = [item]
		}
		return res.render('pages/inventory', {
			content: data
		})
	})
})
router.get('/reduce/:id', function(req, res, next) {
		var productId = req.params.id;
		var cart = new Cart(req.session.cart ? req.session.cart : {});

		cart.reduceByOne(productId);
		req.session.cart = cart;
		res.redirect('/shop/cart');
});
router.get('/addtocart/:id', function(req, res, next) {
	var id = req.params.id;
	// console.log(req.session.cart)
	var cart = new Cart(req.session.cart ? req.session.cart : {items: {}});
	console.log(cart);
	Content.findById(id, function(err, doc) {
		if (err) {
			return res.redirect('/shop/cart');
		}
		cart.add(doc, doc._id);
		req.session.cart = cart;
		return res.redirect('/shop/cart');
	})
});

router.get('/removefromcart/:id', function(req, res, next){
	var id = req.params.id;
	if (!req.session.cart) {
		return res.redirect('/shop/cart');
	}
	var cart = new Cart(req.session.cart);
	Content.findById(id, function(err, doc) {
		if (err) {
			return res.redirect('/shop/cart');
		}
		cart.removeItem(doc, doc._id);
		if (cart.generateArray().length === 0) {
			delete req.session.cart;
			return res.redirect('/shop/cart');
		} else {
			req.session.cart = cart;			
			return res.redirect('/shop/cart');
		}
	});
})

router.get('/cart', function(req, res, next) {
	if (!req.session.cart) {
		return res.render('pages/cart', {cart: null});
	}
	var cart = new Cart(req.session.cart);
	return res.render('pages/cart', {
		cart: cart.generateArray(),
		totalPrice: cart.totalPrice
	});
});

router.get('/checkout', function(req, res, next) {
	if (!req.session.cart) {
		return res.redirect('/shop/cart');
	}
	var cart = new Cart(req.session.cart);
	
	res.render('pages/checkout', {
		pk: process.env.NODE_ENV === 'production' ? process.env.STORE_PUBLISH : process.env.STORE_PUBLISH_TEST,
		total: cart.totalPrice
		// ,
		// csrfToken: req.csrfToken()
	});
});

router.post('/checkout', upload.array(), function(req, res, next) {
	if (!req.session.cart) {
		return res.redirect('/cart');
	}
	var cart = new Cart(req.session.cart);
	var token = req.body.stripeToken;
	var storesecret = process.env.NODE_ENV === 'production' ? process.env.STORE_SECRET : process.env.STORE_SECRET_TEST;
	var stripe = require("stripe")(storesecret);
	var uuid4 = require('uuid/v4');

	stripe.charges.create({
		amount: req.body.total,
		currency: 'usd',
		description: req.session.cart.items[Object.keys(req.session.cart.items)[0]].item.title,
		source: token
	}, {
		idempotency_key: uuid4()
	}, function(err, charge) {
		if (err) {
			console.log(err)
			return res.redirect('/shop/checkout');
		}
		var order = new Order({
			cart: req.session.cart,
			address: req.body.address,
			city: req.body.city,
			zip: req.body.zip,
			state: req.body.state,
			name: req.body.name,
			phone: req.body.phone,
			email: req.body.email
		});
		
		order.save(function(err) {
			if (err) {
				return next(err)
			}
			var cartarray = cart.generateArray()
			// for one-of-a-kind items only
			// for (var i in cartarray) {
			// 	// set doc.price to null once order complete
			// 	Content.findOneAndUpdate({_id: cartarray[i].item._id}, {$set: {'properties.price': null}}, function(err, doc) {
			// 		if (err) {
			// 			return next(err)
			// 		}
			// 
			// 	})
			// }
			req.session.cart = null;
			return res.redirect('/shop/ordersuccess/'+order._id+'')
		})
	});
	
});

router.get('/ordersuccess/:id', function(req, res, next){
	var id = req.params.id;
	Order.findOne({_id: id}, function(err, order){
		if (err) {
			return next(err) 
		}
		var cart = new Cart(order.cart);
		return res.render('pages/order', {
			order: order,
			totalPrice: cart.totalPrice,
			cart: cart.generateArray()
		})
	})
})

module.exports = router;