/* eslint indent: "off" */

var assign = require('object-assign');

var Base = require('./Base');


var Lightbox = function(options) {
  this.next = options.next;
  this.previous = options.previous;

  this.onBodyKeyup = this.onBodyKeyup.bind(this);

  document.body.addEventListener('keyup', this.onBodyKeyup);

  Base.call(this, options);
};

Lightbox.prototype = Object.create(Base.prototype);
Lightbox.prototype.constructor = Lightbox;

assign(Lightbox.prototype, {
  className: 'ocdl-lightbox',

  listeners: function () {
    return {
      'click previous': this.onPreviousClick,
      'click next': this.onNextClick,
      'click close': this.onCloseClick
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
        '<div class="previous-container">',
          '<button class="previous" data-event-id="previous"', (view.previous ? '' : ' disabled'), '>Previous</button>',
        '</div>',
        '<div class="previous-container">',
          '<button class="next" data-event-id="next"', (view.next ? '' : ' disabled'), '>Next</button>',
        '</div>',
        '<button class="close" data-event-id="close"></button>',
      '</div>'
    ];
  },

  remove: function () {
    document.body.removeEventListener('keyup', this.onBodyKeyup);

    Base.prototype.remove.call(this);
  },

  //
  // Listeners

  onBodyKeyup: function (event) {
    if (event.which === 27) this.trigger('close');
  },

  onPreviousClick: function (event) {
    this.trigger('previous');
  },

  onNextClick: function (event) {
    this.trigger('next');
  },

  onCloseClick: function (event) {
    this.trigger('close');
  }
});


module.exports = Lightbox;
