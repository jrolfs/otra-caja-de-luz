var assign = require('object-assign');

var Base = require('./Base');
var Image = require('./Image');
var Lightbox = require('./Lightbox');
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

  showLightbox: function (data) {
    var lightbox = this.lightbox;
    var images = this.data.images;
    var index = images.indexOf(data);
    var next = index < images.length;
    var previous = index > 0;

    if (lightbox) {
      assign(lightbox, { next: next, previous: previous, data: data });
      lightbox.render();
    } else {
      lightbox = this.lightbox = new Lightbox({ next: next, previous: previous, data: data });

      this.bind(lightbox, 'prevous', this.onLightboxPrevious);
      this.bind(lightbox, 'next', this.onLightboxNext);
      this.bind(lightbox, 'close', this.onLightBoxClose);

      document.body.appendChild(lightbox.render().node);
    }
  },

  remove: function () {
    if (this.lightbox) {
      this.unbind(this.lightbox);
      this.lightbox.remove();
    }

    Base.prototype.remove.call(this);
  },

  //
  // Listeners

  onGetData: function (response) {
    this.loading = false;
    this.data = { images: this.adapter.parse(response) };

    this.render();
  },

  onImageOpen: function (data) {
    this.showLightbox(data);
  }
});


module.exports = Gallery;
