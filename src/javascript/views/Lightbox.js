/* eslint indent: "off" */

var assign = require('object-assign');

var Base = require('./Base');


var Lightbox = function(options) {
  this.next = options.next;
  this.previous = options.previous;

  Base.call(this, options);
};

Lightbox.prototype = Object.create(Base.prototype);
Lightbox.prototype.constructor = Lightbox;

assign(Lightbox.prototype, {
  className: 'ocdl-lightbox',

  listeners: function () {
    return {
      click: { id: 'previous', listener: this.onPreviousClick },
      click: { id: 'next', listener: this.onNextClick }
    };
  },

  template: function (view) {
    return [
      '<div class="lightbox">',
        '<h2 class="name">', this.name, '</h2>',
        '<img src="', this.url, '">',
        '<div class="description">',
          '<p>', this.description, '</p>',
        '</div>',
        '<button class="previous" data-event-id="previous">',
        '<button class="next" data-event-id="next">',
        '<button class="close" data-event-id="close">',
      '</div>'
    ];
  },

  //
  // Listeners

  onPreviousClick: function (event) {
    console.log('previous');
  },

  onNextClick: function (event) {
    console.log('next');
  }
});


module.exports = Lightbox;
