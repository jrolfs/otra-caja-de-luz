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
    this.node.innerHtml = this.template.call(escapeObject(this.data));

    if (typeof this.addChildren === 'function') {
      this.children = this.addChildren();
    }

    return this;
  }
});


module.exports = Base;
