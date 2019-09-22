const adminRoutes = require('./admin.js');
const express = require('express');
const router = express.Router();
var multer = require('multer');
const fs = require('fs');
//const sharp = require('sharp');
const config = require('../utils/config.js');
var uploadedImages = config.mount_path;
var upload = multer({
  dest: uploadedImages
});
const {
  ensureAdmin,
  ensureAuthenticated,
  ensureBlogDocument,
  ensureBlogData
} = require('../utils/middleware.js');
const {
  User,
  Blog
} = require('../models/index.js');
const marked = require('marked');
const bodyParser = require("body-parser");
const csrf = require('csurf');
const csrfProtection = csrf({
  cookie: true
});
const mkdirp = require('mkdirp');
const path = require('path');


var curly = function(str) {
  if (!str || typeof str.replace !== 'function') {
    return ''
  } else {
    return str
      .replace(/(\s)'(\w)/g, '$1&lsquo;$2')
      .replace(/(\w)'(\s)/g, '$1&rsquo;$2')
      .replace(/(\s)"(\w)/g, '$1&ldquo;$2')
      .replace(/(\w)"(\s)/g, '$1&rdquo;$2')
      .replace(/(\w\.)"/g, "$1&rdquo;") // Closing doubles
      .replace(/\u2018/g, "&lsquo;")
      .replace(/\u2019/g, "&rsquo;")
      .replace(/\u201c/g, "&ldquo;")
      .replace(/\u201d/g, "&rdquo;")
      .replace(/[“]/g, "&ldquo;")
      .replace(/[”]/g, "&rdquo;")
      .replace(/[’]/g, "&rsquo;")
      .replace(/[‘]/g, "&lsquo;")
      .replace(/([a-z])&lsquo([a-z])/ig, '$1&rsquo;$2')
  }
}

router
  .all('/edit/*', adminRoutes)
  .get('/*/:bid', (req, res, next) => {
    //this is called for both /b/edit/:bid and /b/view/:bid
    req.parsedURL.pathname = req.parsedURL.pathname.replace(req.params.bid, ''); // remove bid
    //Initial vaues
    if (req.params.bid === 'new') {
      const doc = new Blog({
        author: req.user._id,
        creationAuthor: req.user._id,
        lede: "Type here",
        type: "type here",
        title: "type here",
        category: "blog",
        description: "type here",
        date: new Date(),
        creationDate: new Date(),
        media: "",
        tags: ""
      });
      req.doc = doc;
      req.vDoc = JSON.stringify(doc); //this can maybe be deleted only one page needs it
      next();
    } else {
      //Look for blog by uri
      Blog.findOne({
        uri: req.params.bid
      }).lean().exec((err, doc) => {
        if (!doc) {
          //if no uri look by _id
          Blog.findById(req.params.bid).lean().exec((err, doc) => {
            if (err) return next(err);
            if (!doc) next('NOT A BLOG')
            req.doc = doc;
            req.vDoc = JSON.stringify(doc); //this can maybe be deleted only one page needs it
            next();
          })
        } else {
          req.doc = doc;
          req.vDoc = JSON.stringify(doc); //this can maybe be deleted only one page needs it
          next();
        }
      })
    }
  })
  .get('/view/new', (req, res, next) => {
    next("Trying to View newBlog post")
  })
  .post('/edit/:bid',
    upload.single('newimg'),
    bodyParser.urlencoded({
      extended: true
    }),
    (req, res, next) => {
      if (req.params.bid === 'uploadimg') {
        console.log('uploading image');
        console.log(req.file.filename);
        var fn = req.file.filename;
        fs.rename(uploadedImages + fn, uploadedImages + fn + '.jpg', function(err) {
          if (err) {
            console.log('error renaming');
          }
          fn += ".jpg";
          res.write(JSON.stringify({
            "fn": fn
          }));
          res.end();
        });
      } else {
        Blog.findOne({
          _id: req.params.bid
        }, async (err, doc) => {
          if (doc == null) {
            console.log("Couldn't find _id: " + req.params.bid);
            var doc = new Blog({});
            //doc.save();
          };
          var keys = Object.keys(req.body);
          await keys.forEach((key) => {
            if (key !== 'media') {
              doc[key] = req.body[key]
            } else {
              doc.media[0] = {
                "image": req.body.media,
                "caption": req.body.caption
              };
            }
          });
          var d = new Date();
          doc.date = d.toString();
          var cleanupDescription = marked(curly(doc.description));
          doc.description = cleanupDescription;
          if (req.user) doc.author = req.user._id;
          if (!doc.uri) {
            //TODO: make sure uri doesn't already exist
            doc.uri = d.getFullYear().toString() + '-' + doc.title.replace(/ /g, '-') + '-' + d.getMinutes().toString() + d.getSeconds().toString();
          }
          doc.save((err) => {
            if (err) {
              return next(err)
            } else {
              return res.redirect('/b/view/' + doc._id);
            }
          })
        })
      }
    })

  .post('/edit/deleteentry/:bid', async function(req, res, next) {
    var outputPath = url.parse(req.url).pathname;
    console.log(outputPath)
    var id = req.params.bid;
    Blog.findById(id).lean().exec(async (err, doc) => {
      if (err) {
        return next(err)
      }
      var item = doc.media[0]
      var existsImg = await fs.existsSync(item.image_abs);
      if (existsImg) {
        var p = (path.join(__dirname, uploadedImages) + id);
        await fs.rmdirSync(p);
      }
      return res.status(200).send('ok');
    })
  })
  .post('/edit/deletemedia/:bid/:index', function(req, res, next) {
    var id = req.params.bid;
    var index = parseInt(req.params.index, 10);
    Blog.findOne({
      _id: id
    }).lean().exec(async function(err, thisdoc) {
      if (err) {
        return next(err)
      }
      var oip = (!thisdoc.media[index] || !thisdoc.media[index].image_abs ? null : thisdoc.media[index].image_abs);
      var otp = (!thisdoc.media[index] || !thisdoc.media[index].thumb_abs ? null : thisdoc.media[index].thumb_abs);
      var existsImg = await fs.existsSync(oip);
      var existsThumb = await fs.existsSync(otp);
      if (existsImg) await fs.unlinkSync(oip);
      if (existsThumb) await fs.unlinkSync(otp);
      Blog.findOneAndUpdate({
        _id: id
      }, {
        $pull: {
          media: {
            _id: thisdoc.media[index]._id
          }
        }
      }, {
        multi: false,
        new: true
      }, function(err, doc) {
        if (err) {
          return next(err)
        }
        return res.status(200).send(doc);
      })
    })
  });

module.exports = router;
