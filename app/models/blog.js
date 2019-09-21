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
  author: String, //last edited author
  creationAuthor: String, //created author
  category: String,
  lede: String,
  Author_Name: String,
  Author_Bio: String,
  description: String,
  uri: String,
  date: Date, //last edited Date
  creationDate: Date, //creation Date
  media: [Media],
  tags: [String]
}, {
  collection: 'blog'
});

module.exports = mongoose.model('Blog', Blog);
