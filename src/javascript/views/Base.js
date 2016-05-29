var assign = require('object-assign');

var EventEmitter = require('../mixins/EventEmitter');
var escapeObject = require('../utils/Escaper').escapeObject;


function Base(options) {
  options || (options = {});

  this.nodeName = options.nodeName || this.nodeName || 'div';
  this.data = options.data || {};
  this.children = [];

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
  },

  template: function () {
    return [];
  },

  render: function () {
    var templateParts = this.template.call(escapeObject(this.data));

    if (!Array.isArray(templateParts)) {
      throw new Error('Template function must return an array');
    }

    this.node.innerHTML = templateParts.join('');

    if (typeof this.addChildren === 'function') {
      this.children = this.addChildren();
    }

    return this;
  }
});


module.exports = Base;
