var assign = require('object-assign');

var Base = require('./Base');


var Gallery = function(options) {
  Base.call(this, options);
};

Gallery.prototype = Object.create(Base.prototype);
Gallery.prototype.constructor = Gallery;

assign(Gallery.prototype, {
});


module.exports = Gallery;
