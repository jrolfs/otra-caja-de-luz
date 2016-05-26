var assign = require('object-assign');

var EventEmitter = require('../mixins/EventEmitter');


function Base(options) {
  options || (options = {});

  this.nodeName = options.nodeName || this.nodeName || 'div';

  this.createNode();
};

assign(Base.prototype, EventEmitter);

assign(Base.prototype, {
  createNode: function () {
    this.node = document.createElement(this.nodeName);

    if (this.node instanceof window.HTMLUnknownElement) {
      throw new Error('Invalid nodeName provided');
    }

    return this;
  }
});


module.exports = Base;
