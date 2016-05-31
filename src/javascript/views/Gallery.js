var assign = require('object-assign');

var Base = require('./Base');
var Image = require('./Image');
var get = require('../utils/get');


var Gallery = function(options) {
  var adapter = this.adapter = options.adapter;

  this.loading = true;
  this.index = -1;

  get(adapter.url, adapter.headers).then(this.onGetData.bind(this));

  Base.call(this, options);
};

Gallery.prototype = Object.create(Base.prototype);
Gallery.prototype.constructor = Gallery;

assign(Gallery.prototype, {
  className: 'ocdl-gallery',

  template: function (view) {
    return view.loading ? ['<div class="loading"></div>'] : [];
  },

  addChildren: function () {
    if (this.loading) return [];

    var images = this.data.images.map(function (data) {
      return new Image({ data: data }).render();
    });

    images.forEach(function (view) {
      this.bind(view, 'open', this.onImageOpen);
      this.node.appendChild(view.node);
    }, this);

    return images;
  },

  attach: function (node) {
    node.appendChild(this.node);
    return this.render();
  },

  //
  // Listeners

  onGetData: function (response) {
    this.loading = false;
    this.data = { images: this.adapter.parse(response) };

    this.render();
  },

  onImageOpen: function (data) {
    console.log(data);
  }
});


module.exports = Gallery;
