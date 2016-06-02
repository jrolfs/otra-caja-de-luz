var assign = require('object-assign');

var Base = require('./Base');


var Image = function(options) {
  Base.call(this, options);
};

Image.prototype = Object.create(Base.prototype);
Image.prototype.constructor = Image;

assign(Image.prototype, {
  className: 'ocdl-image',

  listeners: function () {
    return {
      click: this.onClick
    };
  },

  template: function () {
    return [
      '<img src="', this.thumb, '">',
      '<span class="name">', this.name, '</span>',
      '<a class="external" target="_blank" href="', this.url, '"></a>'
    ];
  },

  //
  // Listeners

  onClick: function (event) {
    if (event.target.className.match(/external/)) return;
    this.trigger('open', this.data);
  }
});


module.exports = Image;
