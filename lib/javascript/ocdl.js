(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.OCDL = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
/* eslint-disable no-unused-vars */
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (e) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (Object.getOwnPropertySymbols) {
			symbols = Object.getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],2:[function(require,module,exports){
var EventEmitter = {
  on: function(eventName, callback, context) {
    this._events || (this._events = {});
    this._events[eventName] = this._events[eventName] || [];

    this._events[eventName].push({
      callback: callback,
      context: context
    });
  },

  off: function(eventName, callback) {
    if (!this._events) return;

    if (callback) {
      var event = this._events[eventName] || [];
      var i = event.length;

      while (i--) {
        if (callback === event[i].callback) {
          event.splice(i, 1);
        }
      }
    } else {
      delete this._events[eventName];
    }
  },

  trigger: function(eventName) {
    if (!this._events) return;

    var args = [].slice.call(arguments, 1);
    var events = this._events[eventName];

    if (!events) return;

    events.forEach(function(event) {
      event.callback.apply(event.context || this, args);
    }, this);
  }
};


module.exports = EventEmitter;

},{}],3:[function(require,module,exports){
var escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;'
};
var matcher = '(?:' + Object.keys(escapeMap).join('|') + ')';
var tester = new RegExp(matcher);
var replacer = new RegExp(matcher, 'g');

var escape = function(content) {
  content = (content == null) ? '' : String(content);

  if (tester.test(content)) {
    return content.replace(replacer, function (match) {
      return escapeMap[match];
    });
  } else {
    return content;
  }
};

var escapeObject = function (data) {
  var escapedData = {};

  for (var key in data) {
    var value = data[key];
    escapedData[key] = (typeof value === 'object') ? escapeObject(value) : escape(value);
  }

  return escapedData;
};


module.exports = {
  escape: escape,
  escapeObject: escapeObject
};

},{}],4:[function(require,module,exports){
var assign = require('object-assign');

var EventEmitter = require('../mixins/EventEmitter');
var escapeObject = require('../utils/Escaper').escapeObject;


function Base(options) {
  options || (options = {});

  this.nodeName = options.nodeName || this.nodeName || 'div';
  this.className = options.className;

  this.data = options.data || {};

  this._handlers = [];
  this._children = [];
  this._bindings = [];

  this.createNode();
  this.bindListeners();
};

assign(Base.prototype, EventEmitter);

assign(Base.prototype, {
  createNode: function () {
    this.node = document.createElement(this.nodeName);

    if (this.node instanceof HTMLUnknownElement) {
      throw new Error('Invalid nodeName provided');
    }

    if (this.className) this.node.className = this.className;

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

  bind: function (target, event, handler) {
    target.on(event, handler, this);

    this._bindings.push({ target: target, event: event, handler: handler });
  },

  unbind: function (target, event, handler) {
    this._bindings = this._bindings.filter(function (binding) {
      if (binding.target === target) {
        if (event) {
          target.off(event, handler);
        } else if (handler) {
          target.off(binding.event, handler);
        } else {
          target.off(binding.event, binding.handler);
        }
      } else {
        return binding;
      }
    });
  },

  unbindAll: function () {
    while (this._bindings.length) {
      var binding = this._bindings.pop();
      binding.target.off(binding.event);
    }
  },

  render: function () {
    var templateParts = this.template.call(escapeObject(this.data));

    if (!Array.isArray(templateParts)) {
      throw new Error('Template function must return an array');
    }

    this._children.forEach(function (child) {
      this.unbind(child);
    }, this);
    this.removeChildren();

    this.node.innerHTML = templateParts.join('');

    if (typeof this.addChildren === 'function') {
      this._children = this.addChildren();
    }

    return this;
  },

  removeChildren: function () {
    while (this._children.length) this._children.pop().remove();
  },

  remove: function () {
    this.unbindAll();
    this.removeChildren();

    if (typeof this.node.remove === 'function') {
      this.node.remove();
    } else if (this.node.parentNode) {
      this.node.parentNode.removeChild(this.node);
    }
  }
});


module.exports = Base;

},{"../mixins/EventEmitter":2,"../utils/Escaper":3,"object-assign":1}],5:[function(require,module,exports){
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

},{"./Base":4,"object-assign":1}],6:[function(require,module,exports){
module.exports = {
  Gallery: require('./views/Gallery')
};

},{"./views/Gallery":5}]},{},[6])(6)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvb2JqZWN0LWFzc2lnbi9pbmRleC5qcyIsInNyYy9qYXZhc2NyaXB0L21peGlucy9FdmVudEVtaXR0ZXIuanMiLCJzcmMvamF2YXNjcmlwdC91dGlscy9Fc2NhcGVyLmpzIiwic3JjL2phdmFzY3JpcHQvdmlld3MvQmFzZS5qcyIsInNyYy9qYXZhc2NyaXB0L3ZpZXdzL0dhbGxlcnkuanMiLCJzcmMvamF2YXNjcmlwdCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuLyogZXNsaW50LWRpc2FibGUgbm8tdW51c2VkLXZhcnMgKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgcHJvcElzRW51bWVyYWJsZSA9IE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGU7XG5cbmZ1bmN0aW9uIHRvT2JqZWN0KHZhbCkge1xuXHRpZiAodmFsID09PSBudWxsIHx8IHZhbCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignT2JqZWN0LmFzc2lnbiBjYW5ub3QgYmUgY2FsbGVkIHdpdGggbnVsbCBvciB1bmRlZmluZWQnKTtcblx0fVxuXG5cdHJldHVybiBPYmplY3QodmFsKTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkVXNlTmF0aXZlKCkge1xuXHR0cnkge1xuXHRcdGlmICghT2JqZWN0LmFzc2lnbikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIERldGVjdCBidWdneSBwcm9wZXJ0eSBlbnVtZXJhdGlvbiBvcmRlciBpbiBvbGRlciBWOCB2ZXJzaW9ucy5cblxuXHRcdC8vIGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTQxMThcblx0XHR2YXIgdGVzdDEgPSBuZXcgU3RyaW5nKCdhYmMnKTsgIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0XHR0ZXN0MVs1XSA9ICdkZSc7XG5cdFx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRlc3QxKVswXSA9PT0gJzUnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MzA1NlxuXHRcdHZhciB0ZXN0MiA9IHt9O1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgMTA7IGkrKykge1xuXHRcdFx0dGVzdDJbJ18nICsgU3RyaW5nLmZyb21DaGFyQ29kZShpKV0gPSBpO1xuXHRcdH1cblx0XHR2YXIgb3JkZXIyID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVzdDIpLm1hcChmdW5jdGlvbiAobikge1xuXHRcdFx0cmV0dXJuIHRlc3QyW25dO1xuXHRcdH0pO1xuXHRcdGlmIChvcmRlcjIuam9pbignJykgIT09ICcwMTIzNDU2Nzg5Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTMwNTZcblx0XHR2YXIgdGVzdDMgPSB7fTtcblx0XHQnYWJjZGVmZ2hpamtsbW5vcHFyc3QnLnNwbGl0KCcnKS5mb3JFYWNoKGZ1bmN0aW9uIChsZXR0ZXIpIHtcblx0XHRcdHRlc3QzW2xldHRlcl0gPSBsZXR0ZXI7XG5cdFx0fSk7XG5cdFx0aWYgKE9iamVjdC5rZXlzKE9iamVjdC5hc3NpZ24oe30sIHRlc3QzKSkuam9pbignJykgIT09XG5cdFx0XHRcdCdhYmNkZWZnaGlqa2xtbm9wcXJzdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdC8vIFdlIGRvbid0IGV4cGVjdCBhbnkgb2YgdGhlIGFib3ZlIHRvIHRocm93LCBidXQgYmV0dGVyIHRvIGJlIHNhZmUuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2hvdWxkVXNlTmF0aXZlKCkgPyBPYmplY3QuYXNzaWduIDogZnVuY3Rpb24gKHRhcmdldCwgc291cmNlKSB7XG5cdHZhciBmcm9tO1xuXHR2YXIgdG8gPSB0b09iamVjdCh0YXJnZXQpO1xuXHR2YXIgc3ltYm9scztcblxuXHRmb3IgKHZhciBzID0gMTsgcyA8IGFyZ3VtZW50cy5sZW5ndGg7IHMrKykge1xuXHRcdGZyb20gPSBPYmplY3QoYXJndW1lbnRzW3NdKTtcblxuXHRcdGZvciAodmFyIGtleSBpbiBmcm9tKSB7XG5cdFx0XHRpZiAoaGFzT3duUHJvcGVydHkuY2FsbChmcm9tLCBrZXkpKSB7XG5cdFx0XHRcdHRvW2tleV0gPSBmcm9tW2tleV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMpIHtcblx0XHRcdHN5bWJvbHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKGZyb20pO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzeW1ib2xzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChwcm9wSXNFbnVtZXJhYmxlLmNhbGwoZnJvbSwgc3ltYm9sc1tpXSkpIHtcblx0XHRcdFx0XHR0b1tzeW1ib2xzW2ldXSA9IGZyb21bc3ltYm9sc1tpXV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuIiwidmFyIEV2ZW50RW1pdHRlciA9IHtcbiAgb246IGZ1bmN0aW9uKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICB0aGlzLl9ldmVudHMgfHwgKHRoaXMuX2V2ZW50cyA9IHt9KTtcbiAgICB0aGlzLl9ldmVudHNbZXZlbnROYW1lXSA9IHRoaXMuX2V2ZW50c1tldmVudE5hbWVdIHx8IFtdO1xuXG4gICAgdGhpcy5fZXZlbnRzW2V2ZW50TmFtZV0ucHVzaCh7XG4gICAgICBjYWxsYmFjazogY2FsbGJhY2ssXG4gICAgICBjb250ZXh0OiBjb250ZXh0XG4gICAgfSk7XG4gIH0sXG5cbiAgb2ZmOiBmdW5jdGlvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMpIHJldHVybjtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgdmFyIGV2ZW50ID0gdGhpcy5fZXZlbnRzW2V2ZW50TmFtZV0gfHwgW107XG4gICAgICB2YXIgaSA9IGV2ZW50Lmxlbmd0aDtcblxuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBpZiAoY2FsbGJhY2sgPT09IGV2ZW50W2ldLmNhbGxiYWNrKSB7XG4gICAgICAgICAgZXZlbnQuc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbZXZlbnROYW1lXTtcbiAgICB9XG4gIH0sXG5cbiAgdHJpZ2dlcjogZnVuY3Rpb24oZXZlbnROYW1lKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMpIHJldHVybjtcblxuICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHZhciBldmVudHMgPSB0aGlzLl9ldmVudHNbZXZlbnROYW1lXTtcblxuICAgIGlmICghZXZlbnRzKSByZXR1cm47XG5cbiAgICBldmVudHMuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgZXZlbnQuY2FsbGJhY2suYXBwbHkoZXZlbnQuY29udGV4dCB8fCB0aGlzLCBhcmdzKTtcbiAgICB9LCB0aGlzKTtcbiAgfVxufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcbiIsInZhciBlc2NhcGVNYXAgPSB7XG4gICcmJzogJyZhbXA7JyxcbiAgJzwnOiAnJmx0OycsXG4gICc+JzogJyZndDsnLFxuICAnXCInOiAnJnF1b3Q7JyxcbiAgXCInXCI6ICcmI3gyNzsnLFxuICAnYCc6ICcmI3g2MDsnXG59O1xudmFyIG1hdGNoZXIgPSAnKD86JyArIE9iamVjdC5rZXlzKGVzY2FwZU1hcCkuam9pbignfCcpICsgJyknO1xudmFyIHRlc3RlciA9IG5ldyBSZWdFeHAobWF0Y2hlcik7XG52YXIgcmVwbGFjZXIgPSBuZXcgUmVnRXhwKG1hdGNoZXIsICdnJyk7XG5cbnZhciBlc2NhcGUgPSBmdW5jdGlvbihjb250ZW50KSB7XG4gIGNvbnRlbnQgPSAoY29udGVudCA9PSBudWxsKSA/ICcnIDogU3RyaW5nKGNvbnRlbnQpO1xuXG4gIGlmICh0ZXN0ZXIudGVzdChjb250ZW50KSkge1xuICAgIHJldHVybiBjb250ZW50LnJlcGxhY2UocmVwbGFjZXIsIGZ1bmN0aW9uIChtYXRjaCkge1xuICAgICAgcmV0dXJuIGVzY2FwZU1hcFttYXRjaF07XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGNvbnRlbnQ7XG4gIH1cbn07XG5cbnZhciBlc2NhcGVPYmplY3QgPSBmdW5jdGlvbiAoZGF0YSkge1xuICB2YXIgZXNjYXBlZERhdGEgPSB7fTtcblxuICBmb3IgKHZhciBrZXkgaW4gZGF0YSkge1xuICAgIHZhciB2YWx1ZSA9IGRhdGFba2V5XTtcbiAgICBlc2NhcGVkRGF0YVtrZXldID0gKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpID8gZXNjYXBlT2JqZWN0KHZhbHVlKSA6IGVzY2FwZSh2YWx1ZSk7XG4gIH1cblxuICByZXR1cm4gZXNjYXBlZERhdGE7XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBlc2NhcGU6IGVzY2FwZSxcbiAgZXNjYXBlT2JqZWN0OiBlc2NhcGVPYmplY3Rcbn07XG4iLCJ2YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vbWl4aW5zL0V2ZW50RW1pdHRlcicpO1xudmFyIGVzY2FwZU9iamVjdCA9IHJlcXVpcmUoJy4uL3V0aWxzL0VzY2FwZXInKS5lc2NhcGVPYmplY3Q7XG5cblxuZnVuY3Rpb24gQmFzZShvcHRpb25zKSB7XG4gIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG5cbiAgdGhpcy5ub2RlTmFtZSA9IG9wdGlvbnMubm9kZU5hbWUgfHwgdGhpcy5ub2RlTmFtZSB8fCAnZGl2JztcbiAgdGhpcy5jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZTtcblxuICB0aGlzLmRhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG5cbiAgdGhpcy5faGFuZGxlcnMgPSBbXTtcbiAgdGhpcy5fY2hpbGRyZW4gPSBbXTtcbiAgdGhpcy5fYmluZGluZ3MgPSBbXTtcblxuICB0aGlzLmNyZWF0ZU5vZGUoKTtcbiAgdGhpcy5iaW5kTGlzdGVuZXJzKCk7XG59O1xuXG5hc3NpZ24oQmFzZS5wcm90b3R5cGUsIEV2ZW50RW1pdHRlcik7XG5cbmFzc2lnbihCYXNlLnByb3RvdHlwZSwge1xuICBjcmVhdGVOb2RlOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5ub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0aGlzLm5vZGVOYW1lKTtcblxuICAgIGlmICh0aGlzLm5vZGUgaW5zdGFuY2VvZiBIVE1MVW5rbm93bkVsZW1lbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBub2RlTmFtZSBwcm92aWRlZCcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNsYXNzTmFtZSkgdGhpcy5ub2RlLmNsYXNzTmFtZSA9IHRoaXMuY2xhc3NOYW1lO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgYmluZExpc3RlbmVyczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVycygpO1xuICAgIHZhciBkZWxlZ2F0ZSA9IGZ1bmN0aW9uIChldmVudElkLCBoYW5kbGVyKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudC50YXJnZXQuZGF0YXNldC5ldmVudElkICE9PSBldmVudElkKSByZXR1cm47XG5cbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9O1xuXG4gICAgZm9yICh2YXIgZXZlbnQgaW4gbGlzdGVuZXJzKSB7XG4gICAgICB2YXIgZGVzY3JpcHRvciA9IGxpc3RlbmVyc1tldmVudF07XG4gICAgICB2YXIgaGFuZGxlcjtcblxuICAgICAgaWYgKHR5cGVvZiBkZXNjcmlwdG9yID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGhhbmRsZXIgPSBkZXNjcmlwdG9yLmJpbmQodGhpcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodHlwZW9mIGRlc2NyaXB0b3IuaWQgIT09ICdzdHJpbmcnIHx8IHR5cGVvZiBkZXNjcmlwdG9yLmxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBzdXBwbHkgYSB2YWxpZCBldmVudCBJRCBhbmQgbGlzdGVuZXIgd2hlbiBkZWxlZ2F0aW5nIGV2ZW50cycpO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFuZGxlciA9IGRlbGVnYXRlLmJpbmQodGhpcywgZGVzY3JpcHRvci5pZCwgZGVzY3JpcHRvci5saXN0ZW5lcikoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIpO1xuICAgICAgdGhpcy5faGFuZGxlcnMucHVzaCh7IGV2ZW50OiBldmVudCwgaGFuZGxlcjogaGFuZGxlciB9KTtcbiAgICB9XG4gIH0sXG5cbiAgdW5iaW5kTGlzdGVuZXJzOiBmdW5jdGlvbiAoKSB7XG4gICAgd2hpbGUgKHRoaXMuX2hhbmRsZXJzLmxlbmd0aCkge1xuICAgICAgdmFyIGhhbmRsZXIgPSB0aGlzLl9oYW5kbGVycy5wb3AoKTtcbiAgICAgIHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKGhhbmRsZXIuZXZlbnQsIGhhbmRsZXIuaGFuZGxlcik7XG4gICAgfVxuICB9LFxuXG4gIGxpc3RlbmVyczogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7fTtcbiAgfSxcblxuICB0ZW1wbGF0ZTogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBbXTtcbiAgfSxcblxuICBiaW5kOiBmdW5jdGlvbiAodGFyZ2V0LCBldmVudCwgaGFuZGxlcikge1xuICAgIHRhcmdldC5vbihldmVudCwgaGFuZGxlciwgdGhpcyk7XG5cbiAgICB0aGlzLl9iaW5kaW5ncy5wdXNoKHsgdGFyZ2V0OiB0YXJnZXQsIGV2ZW50OiBldmVudCwgaGFuZGxlcjogaGFuZGxlciB9KTtcbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uICh0YXJnZXQsIGV2ZW50LCBoYW5kbGVyKSB7XG4gICAgdGhpcy5fYmluZGluZ3MgPSB0aGlzLl9iaW5kaW5ncy5maWx0ZXIoZnVuY3Rpb24gKGJpbmRpbmcpIHtcbiAgICAgIGlmIChiaW5kaW5nLnRhcmdldCA9PT0gdGFyZ2V0KSB7XG4gICAgICAgIGlmIChldmVudCkge1xuICAgICAgICAgIHRhcmdldC5vZmYoZXZlbnQsIGhhbmRsZXIpO1xuICAgICAgICB9IGVsc2UgaWYgKGhhbmRsZXIpIHtcbiAgICAgICAgICB0YXJnZXQub2ZmKGJpbmRpbmcuZXZlbnQsIGhhbmRsZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRhcmdldC5vZmYoYmluZGluZy5ldmVudCwgYmluZGluZy5oYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgdW5iaW5kQWxsOiBmdW5jdGlvbiAoKSB7XG4gICAgd2hpbGUgKHRoaXMuX2JpbmRpbmdzLmxlbmd0aCkge1xuICAgICAgdmFyIGJpbmRpbmcgPSB0aGlzLl9iaW5kaW5ncy5wb3AoKTtcbiAgICAgIGJpbmRpbmcudGFyZ2V0Lm9mZihiaW5kaW5nLmV2ZW50KTtcbiAgICB9XG4gIH0sXG5cbiAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHRlbXBsYXRlUGFydHMgPSB0aGlzLnRlbXBsYXRlLmNhbGwoZXNjYXBlT2JqZWN0KHRoaXMuZGF0YSkpO1xuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHRlbXBsYXRlUGFydHMpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RlbXBsYXRlIGZ1bmN0aW9uIG11c3QgcmV0dXJuIGFuIGFycmF5Jyk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbiAoY2hpbGQpIHtcbiAgICAgIHRoaXMudW5iaW5kKGNoaWxkKTtcbiAgICB9LCB0aGlzKTtcbiAgICB0aGlzLnJlbW92ZUNoaWxkcmVuKCk7XG5cbiAgICB0aGlzLm5vZGUuaW5uZXJIVE1MID0gdGVtcGxhdGVQYXJ0cy5qb2luKCcnKTtcblxuICAgIGlmICh0eXBlb2YgdGhpcy5hZGRDaGlsZHJlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5fY2hpbGRyZW4gPSB0aGlzLmFkZENoaWxkcmVuKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgcmVtb3ZlQ2hpbGRyZW46IGZ1bmN0aW9uICgpIHtcbiAgICB3aGlsZSAodGhpcy5fY2hpbGRyZW4ubGVuZ3RoKSB0aGlzLl9jaGlsZHJlbi5wb3AoKS5yZW1vdmUoKTtcbiAgfSxcblxuICByZW1vdmU6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnVuYmluZEFsbCgpO1xuICAgIHRoaXMucmVtb3ZlQ2hpbGRyZW4oKTtcblxuICAgIGlmICh0eXBlb2YgdGhpcy5ub2RlLnJlbW92ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5ub2RlLnJlbW92ZSgpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5ub2RlLnBhcmVudE5vZGUpIHtcbiAgICAgIHRoaXMubm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMubm9kZSk7XG4gICAgfVxuICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2U7XG4iLCJ2YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgQmFzZSA9IHJlcXVpcmUoJy4vQmFzZScpO1xuXG5cbnZhciBHYWxsZXJ5ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBCYXNlLmNhbGwodGhpcywgb3B0aW9ucyk7XG59O1xuXG5HYWxsZXJ5LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQmFzZS5wcm90b3R5cGUpO1xuR2FsbGVyeS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBHYWxsZXJ5O1xuXG5hc3NpZ24oR2FsbGVyeS5wcm90b3R5cGUsIHtcbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gR2FsbGVyeTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBHYWxsZXJ5OiByZXF1aXJlKCcuL3ZpZXdzL0dhbGxlcnknKVxufTtcbiJdfQ==
