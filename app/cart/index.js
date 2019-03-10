var express = require('express');
var router = express.Router();
var dotenv = require('dotenv');
var Content = require('../models/content.js');
var Cart = require('../models/cart.js');
var Order = require('../models/order.js');
var multer = require('multer');
var upload = multer();
var url = require('url');
var nodemailer = require('nodemailer');
dotenv.load();

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'saltlakedsa@gmail.com',
    pass: 'rosaluxemburg'
  }
});

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
		return res.redirect('/')
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
				size: 'S',
				qty: 10,
				price: 2100,
				image: '/static/img/shop/DSA-Red.jpg'
			});
			item.save(function(err){
				if (err) {
					return next(err)
				}
				var item2 = new Content({
					title: 't-shirt',
					description: 'Red shirt with full-color DSA SLC artwork',
					time: {
						begin: new Date(),
						end: new Date()
					},
					size: 'M',
					qty: 10,
					price: 2100,
					image: '/static/img/shop/DSA-Red.jpg'
				});
				item2.save(function(err){
					if (err) {
						return next(err)
					}
					var item3 = new Content({
						title: 't-shirt',
						description: 'Red shirt with full-color DSA SLC artwork',
						time: {
							begin: new Date(),
							end: new Date()
						},
						size: 'L',
						qty: 10,
						price: 2100,
						image: '/static/img/shop/DSA-Red.jpg'
					});
					item3.save(function(err){
						if (err) {
							return next(err)
						}
						var item4 = new Content({
							title: 't-shirt',
							description: 'Red shirt with full-color DSA SLC artwork',
							time: {
								begin: new Date(),
								end: new Date()
							},
							size: 'XL',
							qty: 5,
							price: 2500,
							image: '/static/img/shop/DSA-Red.jpg'
						});
						item4.save(function(err){
							if (err) {
								return next(err)
							}
							Content.find({}, function(err, data){
								if (err) {
									return next(err)
								}
								return res.render('pages/inventory', {
									content: data,
									vContent: (!data ? '' : JSON.stringify(data))
								})
							})
						})
					});
				})
			});
		} else {
			if (data.length === 1) {
				Content.deleteMany({}, function(err, data){
					if (err) {
						return next(err)
					}
					return res.redirect('/inventory')
				})
			} else {
				if (data.length === 4 && !data[0].qty) {
					Content.deleteMany({}, function(err, data){
						if (err) {
							return next(err)
						}
						return res.redirect('/inventory')
					})
				} else {
					return res.render('pages/inventory', {
						content: data,
						vContent: (!data ? '' : JSON.stringify(data))
					})
				}
			}
			
		}
		
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
	var cart = new Cart(req.session.cart ? req.session.cart : {items: {}});
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
		cart: cart.generateArray(),
		total: cart.totalPrice
		// ,
		// csrfToken: req.csrfToken()
	});
});

router.post('/checkout', upload.array(), async function(req, res, next) {
	if (!req.session.cart) {
		return res.redirect('/cart');
	}
	var cart = new Cart(req.session.cart);
	if (req.body.ship) {
		// console.log(req.body.ship)
		await cart.calcShipping(parseInt(req.body.ship, 10));
	}
	var body = req.body;
	req.session.cart = cart;
	var token = req.body.stripeToken;
	var storesecret = process.env.NODE_ENV === 'production' ? process.env.STORE_SECRET : process.env.STORE_SECRET_TEST;
	var stripe = require("stripe")(storesecret);
	var uuid4 = require('uuid/v4');
	// console.log(cart)
	var order = new Order({
		cart: req.session.cart,
		address: req.body.address,
		city: req.body.city,
		zip: req.body.zip,
		state: req.body.state,
		name: req.body.name,
		phone: req.body.phone,
		email: req.body.email,
		ship: (req.body.ship && !isNaN(parseInt(req.body.ship, 10)) ? true : false)
	});
	stripe.charges.create({
		amount: req.body.total,
		currency: 'usd',
		description: req.session.cart.items[Object.keys(req.session.cart.items)[0]].item.title,
		source: token,
		metadata: {orderId: JSON.stringify(order._id) }
	}, {
		idempotency_key: uuid4()
	}, function(err, charge) {
		if (err) {
			// console.log(err)
			return res.redirect('/shop/checkout');
		}
		order.save(async function(err) {
			if (err) {
				return next(err)
			}
			var cartarray = cart.generateArray();
			
			for (var i in cartarray) {
				// reduce inventory qty after successful order
				var qty = cartarray[i].qty;
				var iQty = await Content.findOne({_id: cartarray[i].item._id}).then((doc)=>doc.qty).catch((err)=>next(err));
				var newQty = iQty - qty;
				await Content.findOneAndUpdate({_id: cartarray[i].item._id}, {$set: {qty: newQty }}, {new:true, multi:false}).then((doc)=>{}).catch((err)=>next(err))
			}
			req.session.cart = null;
			return res.redirect('/shop/ordersuccess/'+(req.body.ship ? true : false)+'/'+order._id+'')
		})
	});
	
});

router.get('/ordersuccess/:ship/:id', function(req, res, next){
	var id = req.params.id;
	var fn = url.parse(req.url,true).pathname;
	fn = fn.split('/')[2];
	var isShip = (fn == 'true');

	Order.findOne({_id: id}, function(err, order){
		if (err) {
			return next(err) 
		}
		var cart = new Cart(order.cart);
	/* 	var mailOptions = {
			from: 'saltlakedsa@gmail.com',
			to: order.email,
			subject: 'Thank you for your order',
			text: "Your order confirmation is: " + order._id + " Please let us know if you have any questions"
		};
		transporter.sendMail(mailOptions, function(err, info){
			if (err) { return next(err) }
			else {
			//console.log('Email sent: ' + info.response);
		}
		}); */
		return res.render('pages/order', {
			order: order,
			totalPrice: cart.totalPrice,
			cart: cart.generateArray(),
			ship: isShip
		});
	});
	
});

module.exports = router;