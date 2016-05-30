var assign = require('object-assign');

var EventEmitter = require('../mixins/EventEmitter');
var escapeObject = require('../utils/Escaper').escapeObject;


function Base(options) {
  options || (options = {});

  this.nodeName = options.nodeName || this.nodeName || 'div';
  this.data = options.data || {};
  this.children = [];

  this._handlers = [];

  this.createNode();
  this.bindListeners();
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

  bindListeners: function () {
    var listeners = this.listeners();
    var delegate = function (eventId, handler) {
      return function (event) {
        if (event.target.dataset.eventId !== eventId) return;

        handler.apply(this, arguments);
      };
    };

    for (var event in listeners) {
      var descriptor = listeners[event];
      var handler;

      if (typeof descriptor === 'function') {
        handler = descriptor.bind(this);
      } else {
        if (typeof descriptor.id !== 'string' || typeof descriptor.listener !== 'function') {
          throw new Error('You must supply a valid event ID and listener when delegating events');
        }

        handler = delegate.bind(this, descriptor.id, descriptor.listener)();
      }

      this.node.addEventListener(event, handler);
      this._handlers.push({ event: event, handler: handler });
    }
  },

  unbindListeners: function () {
    while (this._handlers.length) {
      var handler = this._handlers.pop();
      this.node.removeEventListener(handler.event, handler.handler);
    }
  },

  listeners: function () {
    return {};
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
  },

  remove: function () {
    this.unbindListeners();

    if (typeof this.node.remove === 'function') {
      this.node.remove();
    } else if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }
});


module.exports = Base;
