'use strict';
var favicon = require('serve-favicon');
var path = require('path');
var fs = require('fs');
var bodyParser = require("body-parser");
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var SlackStrategy = require('passport-slack').Strategy;
var urlparser = require('url');
var express = require('express');
var app = express();
var session = require('express-session');
var mongoose = require('mongoose');
var MongoDBStore = require('connect-mongodb-session')(session);
var cookieParser = require("cookie-parser");
var csrf = require('csurf');
var fUpload = require('multer')();

const config = require('./utils/config.js');
const {
  ensureAdmin,
  ensureAuthenticated,
  ensureBlogDocument,
  ensureBlogData
} = require('./utils/middleware.js');
const {
  adminRoutes,
  blogRoutes,
  cartRoutes
} = require('./routes/index.js');
const {
  User
} = require('./models/index.js');
const stripe = require("stripe")(
  new RegExp('production').test(config.env) ?
  config.storeSecret :
  config.storeSecretTest
);

var port = (new RegExp('production').test(config.env) ? 80 : 3111);
var uploadedImages = config.mount_path;
const csrfProtection = csrf({
  cookie: true
});
const parseForm = bodyParser.urlencoded({
  extended: false
});
const parseJSONBody = bodyParser.json();
const parseBody = [parseJSONBody, parseForm];

var store = new MongoDBStore({
  mongooseConnection: mongoose.connection,
  uri: config.mongourl,
  collection: 'shopSession'
});
store.on('error', function(error) {
  console.log(error);
});

var uri = config.mongourl;
var promise = mongoose.connect(uri, {
  useNewUrlParser: true,
  useFindAndModify: false
});
promise.then(function(db) {
    console.log('db connected')
  })
  .catch((err) => console.error.bind(console, ('connection error:' + err)));

passport.serializeUser(function(user, cb) {
  cb(null, user._id);
});
passport.deserializeUser(function(id, cb) {
  User.findById(id, function(err, user) {
    cb(err, user);
  });
});
passport.use(new LocalStrategy(User.authenticate()));
passport.use(new SlackStrategy({
    clientID: config.slackClientId,
    clientSecret: config.slackClientSecret
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOne({
      'slack.oauthID': profile.user.id
    }).lean().exec(function(err, user) {
      if (err) {
        done(err);
      } else if (!err && user !== null) {
        done(null, user);
      } else {
        User.findOne({
          email: profile.user.email
        }).lean().exec(function(err, user) {
          if (err) {
            done(err);
          } else if (!err && user !== null) {
            // if the user registered previously via LocalStrategy, add the slack oauth id so that person may login with slack on the same user profile
            User.findOneAndUpdate({
              _id: user._id
            }, {
              $set: {
                'slack.oauthID': profile.user.id
              }
            }, {
              new: true,
              safe: true
            }, function(err, usr) {
              if (err) {
                done(err)
              } else {
                done(null, usr);
              }
            })
          } else {
            console.log(profile)
            user = new User({
              username: profile.displayName.replace(/\s/g, '_'),
              email: profile.user.email,
              slack: {
                oauthID: profile.user.id
              },

              admin: (profile.team.domain === 'saltlakedsa'),
              date: new Date()
            });
            user.save(function(err) {
              done(err, user)
            });
          }
        })
      }
    });
  }));

var sess = {
  secret: config.secret,
  name: 'nodecookie',
  resave: true,
  saveUninitialized: true,
  store: store,
  cookie: {
    maxAge: 365 * 24 * 60 * 60 * 1000
  }
}


function logger(req, res, next) {
  req.parsedURL = urlparser.parse(req.url, 'true');
  //console.log(JSON.stringify(req.parsedURL));
  var d = new Date().toLocaleString();
  var u = (req.user != null) ? req.user.username : "NOT LOGGED IN";
  if (!req.session.views) {
    req.session.views = {}
  }
  req.session.views[req.url] = (req.session.views[req.url] || 0) + 1;
  if (req.url == "/") {
    console.log('home');
  } else {
    console.log("\n\n" + req.url + " \n" + req.method + " \nIP: " + req.ip + "  \n" + d + " \nusr: " + u);
    //console.log('visited: '+JSON.stringify(req.session.views,null,2));
    //console.log('errors: '+JSON.stringify(req.session.errors,null,2));
    //console.log('cart: '+JSON.stringify(req.session.cart,null,2));
    //console.log('user: '+JSON.stringify(req.session.user,null,2));
  }
  next();
}

app
  .post('/saveLanguage/:lang', function(req, res, next) {
    var lang = decodeURIComponent(req.params.lang);
    console.log(lang);
    session.lang = lang;
    res.end();
  })
  .set('view engine', 'ejs')
  .set('views', ['views', 'views/partials'])
  .use(favicon(path.join(__dirname, 'public/img', 'favicon.ico')))
  .use('/static', express.static(path.join(__dirname, 'public')))
  .use('/txt', express.static(path.join(__dirname, 'views/txt')))
  .use(session(sess))
  .use('/uploadedImages', express.static(uploadedImages))
  .use(passport.initialize(),
    passport.session(),
    cookieParser(sess.secret),
    logger)
  .get('/committees', (req, res, next) => {
    req.blogQuery = {
      'category': 'Committee'
    };
    next()
  }, ensureBlogData)
  .get('/blog', (req, res, next) => {
      req.blogQuery = {
        'category': 'Blog'
      };
      next()
    },
    ensureBlogData)
  .get('/userinfo', (req, res, next) => {
      var qq = (req.user) ? req.user._id : "";
      req.blogQuery = {
        'author': qq
      };
      next()
    },
    ensureBlogData)
  .get('/logout', function(req, res) {
    req.logout();
    req.session.destroy((err) => {
      if (err) {
        req.session = null;
      }
      res.redirect('/userinfo');
    })
  })
  .get('/auth/slack', passport.authenticate('slack'))

  .get('/auth/slack/callback',
    passport.authenticate('slack', {
      failureRedirect: '/userinfo'
    }),
    (req, res) => {
      req.session.user = req.user;
      return res.redirect('/userinfo');
    })
  .post('/checkauth/:email', async (req, res, next) => {
    var email = decodeURIComponent(req.params.email);
    console.log('this email: ' + email)
    if (config.admin.split(',').indexOf(email) !== -1) {
      const user = await User.findOne({
        email: email
      }).lean().then((u) => u).catch((err) => null);
      if (!user) {
        return res.status(200).send(true)
      } else {
        return res.status(200).send(user)
      }
    } else {
      return res.status(200).send(false)
    }
  })
  .use('/shop', cartRoutes)
  .use('/b', blogRoutes)
  .use('/a', adminRoutes)
  .get('*', (req, res, next) => {
    req.parsedURL.pathname += (req.parsedURL.pathname.endsWith('/')) ? 'index' : '';
    var url = req.parsedURL.pathname;
    console.log("looking up:  " + url);

    fs.stat('views/pages' + url + '.ejs', (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          err = new Error('Not Found');
          err.status = 404;
          return next(err);
        } else {
          return next(err);
        }
      } else {
        return res.render('pages' + url, {
          lang: (session.lang ? session.lang : 'en'),
          reqObj: (req.data ? req.data : null),
          order: (req.order ? req.order : null),
          ship: (req.isShip ? req.isShip : null),
          doc: (req.doc ? req.doc : null),
          pk: process.env.NODE_ENV === 'production' ? process.env.STORE_PUBLISH : process.env.STORE_PUBLISH_TEST,
          content: (req.content ? req.content : null),
          vContent: (req.vContent ? req.vContent : null),
          cart: (req.cart ? req.cart : null),
          totalPrice: (req.totalPrice ? req.totalPrice : null),
          isUser: (!req.query.u && !req.query.e ? false : true),
          username: (!req.query && !req.query.u ? '' : decodeURIComponent(req.query.u)),
          email: (!req.query && !req.query.e ? '' : decodeURIComponent(req.query.e)),
          user: (!req.user ? req.session.user : req.user),
          csrfToken: (typeof req.csrfToken === 'function' ? req.csrfToken() : null),
          data: req.featuredblogs,
          vData: JSON.stringify(req.featuredblogs),
          alertCart: (req.session && req.session.cart ? req.session.cart : null)
        });
      }
    });
  })
  .use(function(err, req, res, next) {
    console.log("!!!ERR0R!!!")
    console.log(err)

    if (!req.session.errors) {
      req.session.errors = {}
    }
    req.session.errors[err] = (req.session.errors[err] || 0) + 1;

    res.status(err.status || 500);
    res.render('pages/error', {
      message: err.message,
      user: null,
      error: {}
    });

  });


app
  .listen(port, function() {
    console.log('Using Node Version: ' + process.version);
    (process.version == 'v10.15.3') ? console.log('..up-to-date'): console.log('expection v10.15.3');
    console.log('Web server listening on port: ' + port);
  });
