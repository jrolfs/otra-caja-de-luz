(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.OCDL = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
(function(global){

//
// Check for native Promise and it has correct interface
//

var NativePromise = global['Promise'];
var nativePromiseSupported =
  NativePromise &&
  // Some of these methods are missing from
  // Firefox/Chrome experimental implementations
  'resolve' in NativePromise &&
  'reject' in NativePromise &&
  'all' in NativePromise &&
  'race' in NativePromise &&
  // Older version of the spec had a resolver object
  // as the arg rather than a function
  (function(){
    var resolve;
    new NativePromise(function(r){ resolve = r; });
    return typeof resolve === 'function';
  })();


//
// export if necessary
//

if (typeof exports !== 'undefined' && exports)
{
  // node.js
  exports.Promise = nativePromiseSupported ? NativePromise : Promise;
  exports.Polyfill = Promise;
}
else
{
  // AMD
  if (typeof define == 'function' && define.amd)
  {
    define(function(){
      return nativePromiseSupported ? NativePromise : Promise;
    });
  }
  else
  {
    // in browser add to global
    if (!nativePromiseSupported)
      global['Promise'] = Promise;
  }
}


//
// Polyfill
//

var PENDING = 'pending';
var SEALED = 'sealed';
var FULFILLED = 'fulfilled';
var REJECTED = 'rejected';
var NOOP = function(){};

function isArray(value) {
  return Object.prototype.toString.call(value) === '[object Array]';
}

// async calls
var asyncSetTimer = typeof setImmediate !== 'undefined' ? setImmediate : setTimeout;
var asyncQueue = [];
var asyncTimer;

function asyncFlush(){
  // run promise callbacks
  for (var i = 0; i < asyncQueue.length; i++)
    asyncQueue[i][0](asyncQueue[i][1]);

  // reset async asyncQueue
  asyncQueue = [];
  asyncTimer = false;
}

function asyncCall(callback, arg){
  asyncQueue.push([callback, arg]);

  if (!asyncTimer)
  {
    asyncTimer = true;
    asyncSetTimer(asyncFlush, 0);
  }
}


function invokeResolver(resolver, promise) {
  function resolvePromise(value) {
    resolve(promise, value);
  }

  function rejectPromise(reason) {
    reject(promise, reason);
  }

  try {
    resolver(resolvePromise, rejectPromise);
  } catch(e) {
    rejectPromise(e);
  }
}

function invokeCallback(subscriber){
  var owner = subscriber.owner;
  var settled = owner.state_;
  var value = owner.data_;  
  var callback = subscriber[settled];
  var promise = subscriber.then;

  if (typeof callback === 'function')
  {
    settled = FULFILLED;
    try {
      value = callback(value);
    } catch(e) {
      reject(promise, e);
    }
  }

  if (!handleThenable(promise, value))
  {
    if (settled === FULFILLED)
      resolve(promise, value);

    if (settled === REJECTED)
      reject(promise, value);
  }
}

function handleThenable(promise, value) {
  var resolved;

  try {
    if (promise === value)
      throw new TypeError('A promises callback cannot return that same promise.');

    if (value && (typeof value === 'function' || typeof value === 'object'))
    {
      var then = value.then;  // then should be retrived only once

      if (typeof then === 'function')
      {
        then.call(value, function(val){
          if (!resolved)
          {
            resolved = true;

            if (value !== val)
              resolve(promise, val);
            else
              fulfill(promise, val);
          }
        }, function(reason){
          if (!resolved)
          {
            resolved = true;

            reject(promise, reason);
          }
        });

        return true;
      }
    }
  } catch (e) {
    if (!resolved)
      reject(promise, e);

    return true;
  }

  return false;
}

function resolve(promise, value){
  if (promise === value || !handleThenable(promise, value))
    fulfill(promise, value);
}

function fulfill(promise, value){
  if (promise.state_ === PENDING)
  {
    promise.state_ = SEALED;
    promise.data_ = value;

    asyncCall(publishFulfillment, promise);
  }
}

function reject(promise, reason){
  if (promise.state_ === PENDING)
  {
    promise.state_ = SEALED;
    promise.data_ = reason;

    asyncCall(publishRejection, promise);
  }
}

function publish(promise) {
  var callbacks = promise.then_;
  promise.then_ = undefined;

  for (var i = 0; i < callbacks.length; i++) {
    invokeCallback(callbacks[i]);
  }
}

function publishFulfillment(promise){
  promise.state_ = FULFILLED;
  publish(promise);
}

function publishRejection(promise){
  promise.state_ = REJECTED;
  publish(promise);
}

/**
* @class
*/
function Promise(resolver){
  if (typeof resolver !== 'function')
    throw new TypeError('Promise constructor takes a function argument');

  if (this instanceof Promise === false)
    throw new TypeError('Failed to construct \'Promise\': Please use the \'new\' operator, this object constructor cannot be called as a function.');

  this.then_ = [];

  invokeResolver(resolver, this);
}

Promise.prototype = {
  constructor: Promise,

  state_: PENDING,
  then_: null,
  data_: undefined,

  then: function(onFulfillment, onRejection){
    var subscriber = {
      owner: this,
      then: new this.constructor(NOOP),
      fulfilled: onFulfillment,
      rejected: onRejection
    };

    if (this.state_ === FULFILLED || this.state_ === REJECTED)
    {
      // already resolved, call callback async
      asyncCall(invokeCallback, subscriber);
    }
    else
    {
      // subscribe
      this.then_.push(subscriber);
    }

    return subscriber.then;
  },

  'catch': function(onRejection) {
    return this.then(null, onRejection);
  }
};

Promise.all = function(promises){
  var Class = this;

  if (!isArray(promises))
    throw new TypeError('You must pass an array to Promise.all().');

  return new Class(function(resolve, reject){
    var results = [];
    var remaining = 0;

    function resolver(index){
      remaining++;
      return function(value){
        results[index] = value;
        if (!--remaining)
          resolve(results);
      };
    }

    for (var i = 0, promise; i < promises.length; i++)
    {
      promise = promises[i];

      if (promise && typeof promise.then === 'function')
        promise.then(resolver(i), reject);
      else
        results[i] = promise;
    }

    if (!remaining)
      resolve(results);
  });
};

Promise.race = function(promises){
  var Class = this;

  if (!isArray(promises))
    throw new TypeError('You must pass an array to Promise.race().');

  return new Class(function(resolve, reject) {
    for (var i = 0, promise; i < promises.length; i++)
    {
      promise = promises[i];

      if (promise && typeof promise.then === 'function')
        promise.then(resolve, reject);
      else
        resolve(promise);
    }
  });
};

Promise.resolve = function(value){
  var Class = this;

  if (value && typeof value === 'object' && value.constructor === Class)
    return value;

  return new Class(function(resolve){
    resolve(value);
  });
};

Promise.reject = function(reason){
  var Class = this;

  return new Class(function(resolve, reject){
    reject(reason);
  });
};

})(typeof window != 'undefined' ? window : typeof global != 'undefined' ? global : typeof self != 'undefined' ? self : this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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
    var escapedValue;

    if (Array.isArray(value)) {
      escapedValue = value.map(function (item) { return escapeObject(item); });
    } else if (typeof value === 'object') {
      escapedValue = escapeObject(value);
    } else {
      escapedValue = escape(value);
    }

    escapedData[key] = escapedValue;
  }

  return escapedData;
};


module.exports = {
  escape: escape,
  escapeObject: escapeObject
};

},{}],5:[function(require,module,exports){
var assign = require('object-assign');


function imgur(options) {
  this.url = this.root + options.sub + '.json';
  this.headers = { 'Authorization': 'Client-ID ' + options.id };

  return this;
}

assign(imgur, {
  root: 'https://api.imgur.com/3/gallery/r/',
  parse: function (response) {
    return response.data.map(function (image) {
      return {
        name: image.title,
        description: image.description || '',
        url: image.link,
        thumb: image.link.replace(/(\.(png|jpg|jpeg))$/, 't$1'),
        width: image.width,
        height: image.height
      };
    });
  }
});


module.exports = imgur.bind(imgur);

},{"object-assign":2}],6:[function(require,module,exports){
var Promise = require('es6-promise-polyfill').Promise;


function get(url, headers) {
  headers || (headers = {});

  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);

    for (var key in headers) {
      xhr.setRequestHeader(key, headers[key]);
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject({
          status: xhr.status,
          message: xhr.statusText
        });
      }
    };

    xhr.send();
  });
}


module.exports = get;

},{"es6-promise-polyfill":1}],7:[function(require,module,exports){
var assign = require('object-assign');

var EventEmitter = require('../mixins/EventEmitter');
var escapeObject = require('../utils/Escaper').escapeObject;


function Base(options) {
  options || (options = {});

  this.nodeName = options.nodeName || this.nodeName || 'div';
  this.className = options.className || this.className;

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

    for (var key in listeners) {
      var event;
      var handler;

      var listener = listeners[key];

      if (typeof listener !== 'function') {
        throw new Error('You must supply a valid event listener');
      }

      if (key.match(/\w\s\w/)) {
        var parts = key.split(/\s/);

        event = parts[0];
        handler = delegate.bind(this, parts[1], listener)();
      } else {
        event = key;
        handler = listener.bind(this);
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
    var templateParts = this.template.call(escapeObject(this.data), this);

    if (!Array.isArray(templateParts)) {
      throw new Error('Template function must return an array');
    }

    this._children.forEach(function (child) { this.unbind(child); }, this);
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

},{"../mixins/EventEmitter":3,"../utils/Escaper":4,"object-assign":2}],8:[function(require,module,exports){
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

},{"../utils/get":6,"./Base":7,"./Image":9,"./Lightbox":10,"object-assign":2}],9:[function(require,module,exports){
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
    this.trigger('open', this.data);
  }
});


module.exports = Image;

},{"./Base":7,"object-assign":2}],10:[function(require,module,exports){
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
      'click previous': this.onPreviousClick,
      'click next': this.onNextClick
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

},{"./Base":7,"object-assign":2}],11:[function(require,module,exports){
module.exports = {
  Gallery: require('./views/Gallery'),
  imgur: require('./utils/adapters/imgur')
};

},{"./utils/adapters/imgur":5,"./views/Gallery":8}]},{},[11])(11)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UtcG9seWZpbGwvcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9vYmplY3QtYXNzaWduL2luZGV4LmpzIiwic3JjL2phdmFzY3JpcHQvbWl4aW5zL0V2ZW50RW1pdHRlci5qcyIsInNyYy9qYXZhc2NyaXB0L3V0aWxzL0VzY2FwZXIuanMiLCJzcmMvamF2YXNjcmlwdC91dGlscy9hZGFwdGVycy9pbWd1ci5qcyIsInNyYy9qYXZhc2NyaXB0L3V0aWxzL2dldC5qcyIsInNyYy9qYXZhc2NyaXB0L3ZpZXdzL0Jhc2UuanMiLCJzcmMvamF2YXNjcmlwdC92aWV3cy9HYWxsZXJ5LmpzIiwic3JjL2phdmFzY3JpcHQvdmlld3MvSW1hZ2UuanMiLCJzcmMvamF2YXNjcmlwdC92aWV3cy9MaWdodGJveC5qcyIsInNyYy9qYXZhc2NyaXB0Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbihnbG9iYWwpe1xuXG4vL1xuLy8gQ2hlY2sgZm9yIG5hdGl2ZSBQcm9taXNlIGFuZCBpdCBoYXMgY29ycmVjdCBpbnRlcmZhY2Vcbi8vXG5cbnZhciBOYXRpdmVQcm9taXNlID0gZ2xvYmFsWydQcm9taXNlJ107XG52YXIgbmF0aXZlUHJvbWlzZVN1cHBvcnRlZCA9XG4gIE5hdGl2ZVByb21pc2UgJiZcbiAgLy8gU29tZSBvZiB0aGVzZSBtZXRob2RzIGFyZSBtaXNzaW5nIGZyb21cbiAgLy8gRmlyZWZveC9DaHJvbWUgZXhwZXJpbWVudGFsIGltcGxlbWVudGF0aW9uc1xuICAncmVzb2x2ZScgaW4gTmF0aXZlUHJvbWlzZSAmJlxuICAncmVqZWN0JyBpbiBOYXRpdmVQcm9taXNlICYmXG4gICdhbGwnIGluIE5hdGl2ZVByb21pc2UgJiZcbiAgJ3JhY2UnIGluIE5hdGl2ZVByb21pc2UgJiZcbiAgLy8gT2xkZXIgdmVyc2lvbiBvZiB0aGUgc3BlYyBoYWQgYSByZXNvbHZlciBvYmplY3RcbiAgLy8gYXMgdGhlIGFyZyByYXRoZXIgdGhhbiBhIGZ1bmN0aW9uXG4gIChmdW5jdGlvbigpe1xuICAgIHZhciByZXNvbHZlO1xuICAgIG5ldyBOYXRpdmVQcm9taXNlKGZ1bmN0aW9uKHIpeyByZXNvbHZlID0gcjsgfSk7XG4gICAgcmV0dXJuIHR5cGVvZiByZXNvbHZlID09PSAnZnVuY3Rpb24nO1xuICB9KSgpO1xuXG5cbi8vXG4vLyBleHBvcnQgaWYgbmVjZXNzYXJ5XG4vL1xuXG5pZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnICYmIGV4cG9ydHMpXG57XG4gIC8vIG5vZGUuanNcbiAgZXhwb3J0cy5Qcm9taXNlID0gbmF0aXZlUHJvbWlzZVN1cHBvcnRlZCA/IE5hdGl2ZVByb21pc2UgOiBQcm9taXNlO1xuICBleHBvcnRzLlBvbHlmaWxsID0gUHJvbWlzZTtcbn1cbmVsc2VcbntcbiAgLy8gQU1EXG4gIGlmICh0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZClcbiAge1xuICAgIGRlZmluZShmdW5jdGlvbigpe1xuICAgICAgcmV0dXJuIG5hdGl2ZVByb21pc2VTdXBwb3J0ZWQgPyBOYXRpdmVQcm9taXNlIDogUHJvbWlzZTtcbiAgICB9KTtcbiAgfVxuICBlbHNlXG4gIHtcbiAgICAvLyBpbiBicm93c2VyIGFkZCB0byBnbG9iYWxcbiAgICBpZiAoIW5hdGl2ZVByb21pc2VTdXBwb3J0ZWQpXG4gICAgICBnbG9iYWxbJ1Byb21pc2UnXSA9IFByb21pc2U7XG4gIH1cbn1cblxuXG4vL1xuLy8gUG9seWZpbGxcbi8vXG5cbnZhciBQRU5ESU5HID0gJ3BlbmRpbmcnO1xudmFyIFNFQUxFRCA9ICdzZWFsZWQnO1xudmFyIEZVTEZJTExFRCA9ICdmdWxmaWxsZWQnO1xudmFyIFJFSkVDVEVEID0gJ3JlamVjdGVkJztcbnZhciBOT09QID0gZnVuY3Rpb24oKXt9O1xuXG5mdW5jdGlvbiBpc0FycmF5KHZhbHVlKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuXG4vLyBhc3luYyBjYWxsc1xudmFyIGFzeW5jU2V0VGltZXIgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlICE9PSAndW5kZWZpbmVkJyA/IHNldEltbWVkaWF0ZSA6IHNldFRpbWVvdXQ7XG52YXIgYXN5bmNRdWV1ZSA9IFtdO1xudmFyIGFzeW5jVGltZXI7XG5cbmZ1bmN0aW9uIGFzeW5jRmx1c2goKXtcbiAgLy8gcnVuIHByb21pc2UgY2FsbGJhY2tzXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXN5bmNRdWV1ZS5sZW5ndGg7IGkrKylcbiAgICBhc3luY1F1ZXVlW2ldWzBdKGFzeW5jUXVldWVbaV1bMV0pO1xuXG4gIC8vIHJlc2V0IGFzeW5jIGFzeW5jUXVldWVcbiAgYXN5bmNRdWV1ZSA9IFtdO1xuICBhc3luY1RpbWVyID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGFzeW5jQ2FsbChjYWxsYmFjaywgYXJnKXtcbiAgYXN5bmNRdWV1ZS5wdXNoKFtjYWxsYmFjaywgYXJnXSk7XG5cbiAgaWYgKCFhc3luY1RpbWVyKVxuICB7XG4gICAgYXN5bmNUaW1lciA9IHRydWU7XG4gICAgYXN5bmNTZXRUaW1lcihhc3luY0ZsdXNoLCAwKTtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIGludm9rZVJlc29sdmVyKHJlc29sdmVyLCBwcm9taXNlKSB7XG4gIGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKSB7XG4gICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiByZWplY3RQcm9taXNlKHJlYXNvbikge1xuICAgIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICByZXNvbHZlcihyZXNvbHZlUHJvbWlzZSwgcmVqZWN0UHJvbWlzZSk7XG4gIH0gY2F0Y2goZSkge1xuICAgIHJlamVjdFByb21pc2UoZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW52b2tlQ2FsbGJhY2soc3Vic2NyaWJlcil7XG4gIHZhciBvd25lciA9IHN1YnNjcmliZXIub3duZXI7XG4gIHZhciBzZXR0bGVkID0gb3duZXIuc3RhdGVfO1xuICB2YXIgdmFsdWUgPSBvd25lci5kYXRhXzsgIFxuICB2YXIgY2FsbGJhY2sgPSBzdWJzY3JpYmVyW3NldHRsZWRdO1xuICB2YXIgcHJvbWlzZSA9IHN1YnNjcmliZXIudGhlbjtcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKVxuICB7XG4gICAgc2V0dGxlZCA9IEZVTEZJTExFRDtcbiAgICB0cnkge1xuICAgICAgdmFsdWUgPSBjYWxsYmFjayh2YWx1ZSk7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICByZWplY3QocHJvbWlzZSwgZSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkpXG4gIHtcbiAgICBpZiAoc2V0dGxlZCA9PT0gRlVMRklMTEVEKVxuICAgICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG5cbiAgICBpZiAoc2V0dGxlZCA9PT0gUkVKRUNURUQpXG4gICAgICByZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlKSB7XG4gIHZhciByZXNvbHZlZDtcblxuICB0cnkge1xuICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSlcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0EgcHJvbWlzZXMgY2FsbGJhY2sgY2Fubm90IHJldHVybiB0aGF0IHNhbWUgcHJvbWlzZS4nKTtcblxuICAgIGlmICh2YWx1ZSAmJiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpKVxuICAgIHtcbiAgICAgIHZhciB0aGVuID0gdmFsdWUudGhlbjsgIC8vIHRoZW4gc2hvdWxkIGJlIHJldHJpdmVkIG9ubHkgb25jZVxuXG4gICAgICBpZiAodHlwZW9mIHRoZW4gPT09ICdmdW5jdGlvbicpXG4gICAgICB7XG4gICAgICAgIHRoZW4uY2FsbCh2YWx1ZSwgZnVuY3Rpb24odmFsKXtcbiAgICAgICAgICBpZiAoIXJlc29sdmVkKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB2YWwpXG4gICAgICAgICAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsKTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgICAgICBpZiAoIXJlc29sdmVkKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoIXJlc29sdmVkKVxuICAgICAgcmVqZWN0KHByb21pc2UsIGUpO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpe1xuICBpZiAocHJvbWlzZSA9PT0gdmFsdWUgfHwgIWhhbmRsZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlKSlcbiAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZnVsZmlsbChwcm9taXNlLCB2YWx1ZSl7XG4gIGlmIChwcm9taXNlLnN0YXRlXyA9PT0gUEVORElORylcbiAge1xuICAgIHByb21pc2Uuc3RhdGVfID0gU0VBTEVEO1xuICAgIHByb21pc2UuZGF0YV8gPSB2YWx1ZTtcblxuICAgIGFzeW5jQ2FsbChwdWJsaXNoRnVsZmlsbG1lbnQsIHByb21pc2UpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlamVjdChwcm9taXNlLCByZWFzb24pe1xuICBpZiAocHJvbWlzZS5zdGF0ZV8gPT09IFBFTkRJTkcpXG4gIHtcbiAgICBwcm9taXNlLnN0YXRlXyA9IFNFQUxFRDtcbiAgICBwcm9taXNlLmRhdGFfID0gcmVhc29uO1xuXG4gICAgYXN5bmNDYWxsKHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2gocHJvbWlzZSkge1xuICB2YXIgY2FsbGJhY2tzID0gcHJvbWlzZS50aGVuXztcbiAgcHJvbWlzZS50aGVuXyA9IHVuZGVmaW5lZDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xuICAgIGludm9rZUNhbGxiYWNrKGNhbGxiYWNrc1tpXSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHVibGlzaEZ1bGZpbGxtZW50KHByb21pc2Upe1xuICBwcm9taXNlLnN0YXRlXyA9IEZVTEZJTExFRDtcbiAgcHVibGlzaChwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gcHVibGlzaFJlamVjdGlvbihwcm9taXNlKXtcbiAgcHJvbWlzZS5zdGF0ZV8gPSBSRUpFQ1RFRDtcbiAgcHVibGlzaChwcm9taXNlKTtcbn1cblxuLyoqXG4qIEBjbGFzc1xuKi9cbmZ1bmN0aW9uIFByb21pc2UocmVzb2x2ZXIpe1xuICBpZiAodHlwZW9mIHJlc29sdmVyICE9PSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Byb21pc2UgY29uc3RydWN0b3IgdGFrZXMgYSBmdW5jdGlvbiBhcmd1bWVudCcpO1xuXG4gIGlmICh0aGlzIGluc3RhbmNlb2YgUHJvbWlzZSA9PT0gZmFsc2UpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmFpbGVkIHRvIGNvbnN0cnVjdCBcXCdQcm9taXNlXFwnOiBQbGVhc2UgdXNlIHRoZSBcXCduZXdcXCcgb3BlcmF0b3IsIHRoaXMgb2JqZWN0IGNvbnN0cnVjdG9yIGNhbm5vdCBiZSBjYWxsZWQgYXMgYSBmdW5jdGlvbi4nKTtcblxuICB0aGlzLnRoZW5fID0gW107XG5cbiAgaW52b2tlUmVzb2x2ZXIocmVzb2x2ZXIsIHRoaXMpO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IFByb21pc2UsXG5cbiAgc3RhdGVfOiBQRU5ESU5HLFxuICB0aGVuXzogbnVsbCxcbiAgZGF0YV86IHVuZGVmaW5lZCxcblxuICB0aGVuOiBmdW5jdGlvbihvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbil7XG4gICAgdmFyIHN1YnNjcmliZXIgPSB7XG4gICAgICBvd25lcjogdGhpcyxcbiAgICAgIHRoZW46IG5ldyB0aGlzLmNvbnN0cnVjdG9yKE5PT1ApLFxuICAgICAgZnVsZmlsbGVkOiBvbkZ1bGZpbGxtZW50LFxuICAgICAgcmVqZWN0ZWQ6IG9uUmVqZWN0aW9uXG4gICAgfTtcblxuICAgIGlmICh0aGlzLnN0YXRlXyA9PT0gRlVMRklMTEVEIHx8IHRoaXMuc3RhdGVfID09PSBSRUpFQ1RFRClcbiAgICB7XG4gICAgICAvLyBhbHJlYWR5IHJlc29sdmVkLCBjYWxsIGNhbGxiYWNrIGFzeW5jXG4gICAgICBhc3luY0NhbGwoaW52b2tlQ2FsbGJhY2ssIHN1YnNjcmliZXIpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgLy8gc3Vic2NyaWJlXG4gICAgICB0aGlzLnRoZW5fLnB1c2goc3Vic2NyaWJlcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1YnNjcmliZXIudGhlbjtcbiAgfSxcblxuICAnY2F0Y2gnOiBmdW5jdGlvbihvblJlamVjdGlvbikge1xuICAgIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3Rpb24pO1xuICB9XG59O1xuXG5Qcm9taXNlLmFsbCA9IGZ1bmN0aW9uKHByb21pc2VzKXtcbiAgdmFyIENsYXNzID0gdGhpcztcblxuICBpZiAoIWlzQXJyYXkocHJvbWlzZXMpKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gUHJvbWlzZS5hbGwoKS4nKTtcblxuICByZXR1cm4gbmV3IENsYXNzKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICB2YXIgcmVtYWluaW5nID0gMDtcblxuICAgIGZ1bmN0aW9uIHJlc29sdmVyKGluZGV4KXtcbiAgICAgIHJlbWFpbmluZysrO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgICAgcmVzdWx0c1tpbmRleF0gPSB2YWx1ZTtcbiAgICAgICAgaWYgKCEtLXJlbWFpbmluZylcbiAgICAgICAgICByZXNvbHZlKHJlc3VsdHMpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMCwgcHJvbWlzZTsgaSA8IHByb21pc2VzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgIHByb21pc2UgPSBwcm9taXNlc1tpXTtcblxuICAgICAgaWYgKHByb21pc2UgJiYgdHlwZW9mIHByb21pc2UudGhlbiA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmVyKGkpLCByZWplY3QpO1xuICAgICAgZWxzZVxuICAgICAgICByZXN1bHRzW2ldID0gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBpZiAoIXJlbWFpbmluZylcbiAgICAgIHJlc29sdmUocmVzdWx0cyk7XG4gIH0pO1xufTtcblxuUHJvbWlzZS5yYWNlID0gZnVuY3Rpb24ocHJvbWlzZXMpe1xuICB2YXIgQ2xhc3MgPSB0aGlzO1xuXG4gIGlmICghaXNBcnJheShwcm9taXNlcykpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byBQcm9taXNlLnJhY2UoKS4nKTtcblxuICByZXR1cm4gbmV3IENsYXNzKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIGZvciAodmFyIGkgPSAwLCBwcm9taXNlOyBpIDwgcHJvbWlzZXMubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgcHJvbWlzZSA9IHByb21pc2VzW2ldO1xuXG4gICAgICBpZiAocHJvbWlzZSAmJiB0eXBlb2YgcHJvbWlzZS50aGVuID09PSAnZnVuY3Rpb24nKVxuICAgICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzb2x2ZShwcm9taXNlKTtcbiAgICB9XG4gIH0pO1xufTtcblxuUHJvbWlzZS5yZXNvbHZlID0gZnVuY3Rpb24odmFsdWUpe1xuICB2YXIgQ2xhc3MgPSB0aGlzO1xuXG4gIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlLmNvbnN0cnVjdG9yID09PSBDbGFzcylcbiAgICByZXR1cm4gdmFsdWU7XG5cbiAgcmV0dXJuIG5ldyBDbGFzcyhmdW5jdGlvbihyZXNvbHZlKXtcbiAgICByZXNvbHZlKHZhbHVlKTtcbiAgfSk7XG59O1xuXG5Qcm9taXNlLnJlamVjdCA9IGZ1bmN0aW9uKHJlYXNvbil7XG4gIHZhciBDbGFzcyA9IHRoaXM7XG5cbiAgcmV0dXJuIG5ldyBDbGFzcyhmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlamVjdChyZWFzb24pO1xuICB9KTtcbn07XG5cbn0pKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB0eXBlb2YgZ2xvYmFsICE9ICd1bmRlZmluZWQnID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT0gJ3VuZGVmaW5lZCcgPyBzZWxmIDogdGhpcyk7XG4iLCIndXNlIHN0cmljdCc7XG4vKiBlc2xpbnQtZGlzYWJsZSBuby11bnVzZWQtdmFycyAqL1xudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbnZhciBwcm9wSXNFbnVtZXJhYmxlID0gT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuZnVuY3Rpb24gdG9PYmplY3QodmFsKSB7XG5cdGlmICh2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdPYmplY3QuYXNzaWduIGNhbm5vdCBiZSBjYWxsZWQgd2l0aCBudWxsIG9yIHVuZGVmaW5lZCcpO1xuXHR9XG5cblx0cmV0dXJuIE9iamVjdCh2YWwpO1xufVxuXG5mdW5jdGlvbiBzaG91bGRVc2VOYXRpdmUoKSB7XG5cdHRyeSB7XG5cdFx0aWYgKCFPYmplY3QuYXNzaWduKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gRGV0ZWN0IGJ1Z2d5IHByb3BlcnR5IGVudW1lcmF0aW9uIG9yZGVyIGluIG9sZGVyIFY4IHZlcnNpb25zLlxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9NDExOFxuXHRcdHZhciB0ZXN0MSA9IG5ldyBTdHJpbmcoJ2FiYycpOyAgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuXHRcdHRlc3QxWzVdID0gJ2RlJztcblx0XHRpZiAoT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVzdDEpWzBdID09PSAnNScpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0zMDU2XG5cdFx0dmFyIHRlc3QyID0ge307XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCAxMDsgaSsrKSB7XG5cdFx0XHR0ZXN0MlsnXycgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGkpXSA9IGk7XG5cdFx0fVxuXHRcdHZhciBvcmRlcjIgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0ZXN0MikubWFwKGZ1bmN0aW9uIChuKSB7XG5cdFx0XHRyZXR1cm4gdGVzdDJbbl07XG5cdFx0fSk7XG5cdFx0aWYgKG9yZGVyMi5qb2luKCcnKSAhPT0gJzAxMjM0NTY3ODknKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MzA1NlxuXHRcdHZhciB0ZXN0MyA9IHt9O1xuXHRcdCdhYmNkZWZnaGlqa2xtbm9wcXJzdCcuc3BsaXQoJycpLmZvckVhY2goZnVuY3Rpb24gKGxldHRlcikge1xuXHRcdFx0dGVzdDNbbGV0dGVyXSA9IGxldHRlcjtcblx0XHR9KTtcblx0XHRpZiAoT2JqZWN0LmtleXMoT2JqZWN0LmFzc2lnbih7fSwgdGVzdDMpKS5qb2luKCcnKSAhPT1cblx0XHRcdFx0J2FiY2RlZmdoaWprbG1ub3BxcnN0Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0Ly8gV2UgZG9uJ3QgZXhwZWN0IGFueSBvZiB0aGUgYWJvdmUgdG8gdGhyb3csIGJ1dCBiZXR0ZXIgdG8gYmUgc2FmZS5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzaG91bGRVc2VOYXRpdmUoKSA/IE9iamVjdC5hc3NpZ24gOiBmdW5jdGlvbiAodGFyZ2V0LCBzb3VyY2UpIHtcblx0dmFyIGZyb207XG5cdHZhciB0byA9IHRvT2JqZWN0KHRhcmdldCk7XG5cdHZhciBzeW1ib2xzO1xuXG5cdGZvciAodmFyIHMgPSAxOyBzIDwgYXJndW1lbnRzLmxlbmd0aDsgcysrKSB7XG5cdFx0ZnJvbSA9IE9iamVjdChhcmd1bWVudHNbc10pO1xuXG5cdFx0Zm9yICh2YXIga2V5IGluIGZyb20pIHtcblx0XHRcdGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGZyb20sIGtleSkpIHtcblx0XHRcdFx0dG9ba2V5XSA9IGZyb21ba2V5XTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scykge1xuXHRcdFx0c3ltYm9scyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMoZnJvbSk7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHN5bWJvbHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHByb3BJc0VudW1lcmFibGUuY2FsbChmcm9tLCBzeW1ib2xzW2ldKSkge1xuXHRcdFx0XHRcdHRvW3N5bWJvbHNbaV1dID0gZnJvbVtzeW1ib2xzW2ldXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0bztcbn07XG4iLCJ2YXIgRXZlbnRFbWl0dGVyID0ge1xuICBvbjogZnVuY3Rpb24oZXZlbnROYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgIHRoaXMuX2V2ZW50cyB8fCAodGhpcy5fZXZlbnRzID0ge30pO1xuICAgIHRoaXMuX2V2ZW50c1tldmVudE5hbWVdID0gdGhpcy5fZXZlbnRzW2V2ZW50TmFtZV0gfHwgW107XG5cbiAgICB0aGlzLl9ldmVudHNbZXZlbnROYW1lXS5wdXNoKHtcbiAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcbiAgICAgIGNvbnRleHQ6IGNvbnRleHRcbiAgICB9KTtcbiAgfSxcblxuICBvZmY6IGZ1bmN0aW9uKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cykgcmV0dXJuO1xuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICB2YXIgZXZlbnQgPSB0aGlzLl9ldmVudHNbZXZlbnROYW1lXSB8fCBbXTtcbiAgICAgIHZhciBpID0gZXZlbnQubGVuZ3RoO1xuXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGlmIChjYWxsYmFjayA9PT0gZXZlbnRbaV0uY2FsbGJhY2spIHtcbiAgICAgICAgICBldmVudC5zcGxpY2UoaSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1tldmVudE5hbWVdO1xuICAgIH1cbiAgfSxcblxuICB0cmlnZ2VyOiBmdW5jdGlvbihldmVudE5hbWUpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cykgcmV0dXJuO1xuXG4gICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgdmFyIGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tldmVudE5hbWVdO1xuXG4gICAgaWYgKCFldmVudHMpIHJldHVybjtcblxuICAgIGV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICBldmVudC5jYWxsYmFjay5hcHBseShldmVudC5jb250ZXh0IHx8IHRoaXMsIGFyZ3MpO1xuICAgIH0sIHRoaXMpO1xuICB9XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuIiwidmFyIGVzY2FwZU1hcCA9IHtcbiAgJyYnOiAnJmFtcDsnLFxuICAnPCc6ICcmbHQ7JyxcbiAgJz4nOiAnJmd0OycsXG4gICdcIic6ICcmcXVvdDsnLFxuICBcIidcIjogJyYjeDI3OycsXG4gICdgJzogJyYjeDYwOydcbn07XG52YXIgbWF0Y2hlciA9ICcoPzonICsgT2JqZWN0LmtleXMoZXNjYXBlTWFwKS5qb2luKCd8JykgKyAnKSc7XG52YXIgdGVzdGVyID0gbmV3IFJlZ0V4cChtYXRjaGVyKTtcbnZhciByZXBsYWNlciA9IG5ldyBSZWdFeHAobWF0Y2hlciwgJ2cnKTtcblxudmFyIGVzY2FwZSA9IGZ1bmN0aW9uKGNvbnRlbnQpIHtcbiAgY29udGVudCA9IChjb250ZW50ID09IG51bGwpID8gJycgOiBTdHJpbmcoY29udGVudCk7XG5cbiAgaWYgKHRlc3Rlci50ZXN0KGNvbnRlbnQpKSB7XG4gICAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZShyZXBsYWNlciwgZnVuY3Rpb24gKG1hdGNoKSB7XG4gICAgICByZXR1cm4gZXNjYXBlTWFwW21hdGNoXTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gY29udGVudDtcbiAgfVxufTtcblxudmFyIGVzY2FwZU9iamVjdCA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gIHZhciBlc2NhcGVkRGF0YSA9IHt9O1xuXG4gIGZvciAodmFyIGtleSBpbiBkYXRhKSB7XG4gICAgdmFyIHZhbHVlID0gZGF0YVtrZXldO1xuICAgIHZhciBlc2NhcGVkVmFsdWU7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIGVzY2FwZWRWYWx1ZSA9IHZhbHVlLm1hcChmdW5jdGlvbiAoaXRlbSkgeyByZXR1cm4gZXNjYXBlT2JqZWN0KGl0ZW0pOyB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGVzY2FwZWRWYWx1ZSA9IGVzY2FwZU9iamVjdCh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVzY2FwZWRWYWx1ZSA9IGVzY2FwZSh2YWx1ZSk7XG4gICAgfVxuXG4gICAgZXNjYXBlZERhdGFba2V5XSA9IGVzY2FwZWRWYWx1ZTtcbiAgfVxuXG4gIHJldHVybiBlc2NhcGVkRGF0YTtcbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGVzY2FwZTogZXNjYXBlLFxuICBlc2NhcGVPYmplY3Q6IGVzY2FwZU9iamVjdFxufTtcbiIsInZhciBhc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cblxuZnVuY3Rpb24gaW1ndXIob3B0aW9ucykge1xuICB0aGlzLnVybCA9IHRoaXMucm9vdCArIG9wdGlvbnMuc3ViICsgJy5qc29uJztcbiAgdGhpcy5oZWFkZXJzID0geyAnQXV0aG9yaXphdGlvbic6ICdDbGllbnQtSUQgJyArIG9wdGlvbnMuaWQgfTtcblxuICByZXR1cm4gdGhpcztcbn1cblxuYXNzaWduKGltZ3VyLCB7XG4gIHJvb3Q6ICdodHRwczovL2FwaS5pbWd1ci5jb20vMy9nYWxsZXJ5L3IvJyxcbiAgcGFyc2U6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgIHJldHVybiByZXNwb25zZS5kYXRhLm1hcChmdW5jdGlvbiAoaW1hZ2UpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IGltYWdlLnRpdGxlLFxuICAgICAgICBkZXNjcmlwdGlvbjogaW1hZ2UuZGVzY3JpcHRpb24gfHwgJycsXG4gICAgICAgIHVybDogaW1hZ2UubGluayxcbiAgICAgICAgdGh1bWI6IGltYWdlLmxpbmsucmVwbGFjZSgvKFxcLihwbmd8anBnfGpwZWcpKSQvLCAndCQxJyksXG4gICAgICAgIHdpZHRoOiBpbWFnZS53aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBpbWFnZS5oZWlnaHRcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gaW1ndXIuYmluZChpbWd1cik7XG4iLCJ2YXIgUHJvbWlzZSA9IHJlcXVpcmUoJ2VzNi1wcm9taXNlLXBvbHlmaWxsJykuUHJvbWlzZTtcblxuXG5mdW5jdGlvbiBnZXQodXJsLCBoZWFkZXJzKSB7XG4gIGhlYWRlcnMgfHwgKGhlYWRlcnMgPSB7fSk7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICB4aHIub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgIGZvciAodmFyIGtleSBpbiBoZWFkZXJzKSB7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIGhlYWRlcnNba2V5XSk7XG4gICAgfVxuXG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSAhPT0gNCkgcmV0dXJuO1xuXG4gICAgICBpZiAoeGhyLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgIHJlc29sdmUoSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWplY3Qoe1xuICAgICAgICAgIHN0YXR1czogeGhyLnN0YXR1cyxcbiAgICAgICAgICBtZXNzYWdlOiB4aHIuc3RhdHVzVGV4dFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgeGhyLnNlbmQoKTtcbiAgfSk7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBnZXQ7XG4iLCJ2YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vbWl4aW5zL0V2ZW50RW1pdHRlcicpO1xudmFyIGVzY2FwZU9iamVjdCA9IHJlcXVpcmUoJy4uL3V0aWxzL0VzY2FwZXInKS5lc2NhcGVPYmplY3Q7XG5cblxuZnVuY3Rpb24gQmFzZShvcHRpb25zKSB7XG4gIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG5cbiAgdGhpcy5ub2RlTmFtZSA9IG9wdGlvbnMubm9kZU5hbWUgfHwgdGhpcy5ub2RlTmFtZSB8fCAnZGl2JztcbiAgdGhpcy5jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZSB8fCB0aGlzLmNsYXNzTmFtZTtcblxuICB0aGlzLmRhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG5cbiAgdGhpcy5faGFuZGxlcnMgPSBbXTtcbiAgdGhpcy5fY2hpbGRyZW4gPSBbXTtcbiAgdGhpcy5fYmluZGluZ3MgPSBbXTtcblxuICB0aGlzLmNyZWF0ZU5vZGUoKTtcbiAgdGhpcy5iaW5kTGlzdGVuZXJzKCk7XG59O1xuXG5hc3NpZ24oQmFzZS5wcm90b3R5cGUsIEV2ZW50RW1pdHRlcik7XG5cbmFzc2lnbihCYXNlLnByb3RvdHlwZSwge1xuICBjcmVhdGVOb2RlOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5ub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0aGlzLm5vZGVOYW1lKTtcblxuICAgIGlmICh0aGlzLm5vZGUgaW5zdGFuY2VvZiBIVE1MVW5rbm93bkVsZW1lbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBub2RlTmFtZSBwcm92aWRlZCcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNsYXNzTmFtZSkgdGhpcy5ub2RlLmNsYXNzTmFtZSA9IHRoaXMuY2xhc3NOYW1lO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgYmluZExpc3RlbmVyczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVycygpO1xuICAgIHZhciBkZWxlZ2F0ZSA9IGZ1bmN0aW9uIChldmVudElkLCBoYW5kbGVyKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudC50YXJnZXQuZGF0YXNldC5ldmVudElkICE9PSBldmVudElkKSByZXR1cm47XG5cbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9O1xuXG4gICAgZm9yICh2YXIga2V5IGluIGxpc3RlbmVycykge1xuICAgICAgdmFyIGV2ZW50O1xuICAgICAgdmFyIGhhbmRsZXI7XG5cbiAgICAgIHZhciBsaXN0ZW5lciA9IGxpc3RlbmVyc1trZXldO1xuXG4gICAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3Qgc3VwcGx5IGEgdmFsaWQgZXZlbnQgbGlzdGVuZXInKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGtleS5tYXRjaCgvXFx3XFxzXFx3LykpIHtcbiAgICAgICAgdmFyIHBhcnRzID0ga2V5LnNwbGl0KC9cXHMvKTtcblxuICAgICAgICBldmVudCA9IHBhcnRzWzBdO1xuICAgICAgICBoYW5kbGVyID0gZGVsZWdhdGUuYmluZCh0aGlzLCBwYXJ0c1sxXSwgbGlzdGVuZXIpKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBldmVudCA9IGtleTtcbiAgICAgICAgaGFuZGxlciA9IGxpc3RlbmVyLmJpbmQodGhpcyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMubm9kZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyKTtcbiAgICAgIHRoaXMuX2hhbmRsZXJzLnB1c2goeyBldmVudDogZXZlbnQsIGhhbmRsZXI6IGhhbmRsZXIgfSk7XG4gICAgfVxuICB9LFxuXG4gIHVuYmluZExpc3RlbmVyczogZnVuY3Rpb24gKCkge1xuICAgIHdoaWxlICh0aGlzLl9oYW5kbGVycy5sZW5ndGgpIHtcbiAgICAgIHZhciBoYW5kbGVyID0gdGhpcy5faGFuZGxlcnMucG9wKCk7XG4gICAgICB0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihoYW5kbGVyLmV2ZW50LCBoYW5kbGVyLmhhbmRsZXIpO1xuICAgIH1cbiAgfSxcblxuICBsaXN0ZW5lcnM6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge307XG4gIH0sXG5cbiAgdGVtcGxhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gW107XG4gIH0sXG5cbiAgYmluZDogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGhhbmRsZXIpIHtcbiAgICB0YXJnZXQub24oZXZlbnQsIGhhbmRsZXIsIHRoaXMpO1xuXG4gICAgdGhpcy5fYmluZGluZ3MucHVzaCh7IHRhcmdldDogdGFyZ2V0LCBldmVudDogZXZlbnQsIGhhbmRsZXI6IGhhbmRsZXIgfSk7XG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiAodGFyZ2V0LCBldmVudCwgaGFuZGxlcikge1xuICAgIHRoaXMuX2JpbmRpbmdzID0gdGhpcy5fYmluZGluZ3MuZmlsdGVyKGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICBpZiAoYmluZGluZy50YXJnZXQgPT09IHRhcmdldCkge1xuICAgICAgICBpZiAoZXZlbnQpIHtcbiAgICAgICAgICB0YXJnZXQub2ZmKGV2ZW50LCBoYW5kbGVyKTtcbiAgICAgICAgfSBlbHNlIGlmIChoYW5kbGVyKSB7XG4gICAgICAgICAgdGFyZ2V0Lm9mZihiaW5kaW5nLmV2ZW50LCBoYW5kbGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0YXJnZXQub2ZmKGJpbmRpbmcuZXZlbnQsIGJpbmRpbmcuaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBiaW5kaW5nO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIHVuYmluZEFsbDogZnVuY3Rpb24gKCkge1xuICAgIHdoaWxlICh0aGlzLl9iaW5kaW5ncy5sZW5ndGgpIHtcbiAgICAgIHZhciBiaW5kaW5nID0gdGhpcy5fYmluZGluZ3MucG9wKCk7XG4gICAgICBiaW5kaW5nLnRhcmdldC5vZmYoYmluZGluZy5ldmVudCk7XG4gICAgfVxuICB9LFxuXG4gIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgIHZhciB0ZW1wbGF0ZVBhcnRzID0gdGhpcy50ZW1wbGF0ZS5jYWxsKGVzY2FwZU9iamVjdCh0aGlzLmRhdGEpLCB0aGlzKTtcblxuICAgIGlmICghQXJyYXkuaXNBcnJheSh0ZW1wbGF0ZVBhcnRzKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUZW1wbGF0ZSBmdW5jdGlvbiBtdXN0IHJldHVybiBhbiBhcnJheScpO1xuICAgIH1cblxuICAgIHRoaXMuX2NoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkKSB7IHRoaXMudW5iaW5kKGNoaWxkKTsgfSwgdGhpcyk7XG4gICAgdGhpcy5yZW1vdmVDaGlsZHJlbigpO1xuXG4gICAgdGhpcy5ub2RlLmlubmVySFRNTCA9IHRlbXBsYXRlUGFydHMuam9pbignJyk7XG5cbiAgICBpZiAodHlwZW9mIHRoaXMuYWRkQ2hpbGRyZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuX2NoaWxkcmVuID0gdGhpcy5hZGRDaGlsZHJlbigpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHJlbW92ZUNoaWxkcmVuOiBmdW5jdGlvbiAoKSB7XG4gICAgd2hpbGUgKHRoaXMuX2NoaWxkcmVuLmxlbmd0aCkgdGhpcy5fY2hpbGRyZW4ucG9wKCkucmVtb3ZlKCk7XG4gIH0sXG5cbiAgcmVtb3ZlOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy51bmJpbmRBbGwoKTtcbiAgICB0aGlzLnJlbW92ZUNoaWxkcmVuKCk7XG5cbiAgICBpZiAodHlwZW9mIHRoaXMubm9kZS5yZW1vdmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMubm9kZS5yZW1vdmUoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMubm9kZS5wYXJlbnROb2RlKSB7XG4gICAgICB0aGlzLm5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLm5vZGUpO1xuICAgIH1cbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlO1xuIiwidmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIEJhc2UgPSByZXF1aXJlKCcuL0Jhc2UnKTtcbnZhciBJbWFnZSA9IHJlcXVpcmUoJy4vSW1hZ2UnKTtcbnZhciBMaWdodGJveCA9IHJlcXVpcmUoJy4vTGlnaHRib3gnKTtcbnZhciBnZXQgPSByZXF1aXJlKCcuLi91dGlscy9nZXQnKTtcblxuXG52YXIgR2FsbGVyeSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgdmFyIGFkYXB0ZXIgPSB0aGlzLmFkYXB0ZXIgPSBvcHRpb25zLmFkYXB0ZXI7XG5cbiAgdGhpcy5sb2FkaW5nID0gdHJ1ZTtcbiAgdGhpcy5pbmRleCA9IC0xO1xuXG4gIGdldChhZGFwdGVyLnVybCwgYWRhcHRlci5oZWFkZXJzKS50aGVuKHRoaXMub25HZXREYXRhLmJpbmQodGhpcykpO1xuXG4gIEJhc2UuY2FsbCh0aGlzLCBvcHRpb25zKTtcbn07XG5cbkdhbGxlcnkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShCYXNlLnByb3RvdHlwZSk7XG5HYWxsZXJ5LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEdhbGxlcnk7XG5cbmFzc2lnbihHYWxsZXJ5LnByb3RvdHlwZSwge1xuICBjbGFzc05hbWU6ICdvY2RsLWdhbGxlcnknLFxuXG4gIHRlbXBsYXRlOiBmdW5jdGlvbiAodmlldykge1xuICAgIHJldHVybiB2aWV3LmxvYWRpbmcgPyBbJzxkaXYgY2xhc3M9XCJsb2FkaW5nXCI+PC9kaXY+J10gOiBbXTtcbiAgfSxcblxuICBhZGRDaGlsZHJlbjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmxvYWRpbmcpIHJldHVybiBbXTtcblxuICAgIHZhciBpbWFnZXMgPSB0aGlzLmRhdGEuaW1hZ2VzLm1hcChmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgcmV0dXJuIG5ldyBJbWFnZSh7IGRhdGE6IGRhdGEgfSkucmVuZGVyKCk7XG4gICAgfSk7XG5cbiAgICBpbWFnZXMuZm9yRWFjaChmdW5jdGlvbiAodmlldykge1xuICAgICAgdGhpcy5iaW5kKHZpZXcsICdvcGVuJywgdGhpcy5vbkltYWdlT3Blbik7XG4gICAgICB0aGlzLm5vZGUuYXBwZW5kQ2hpbGQodmlldy5ub2RlKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHJldHVybiBpbWFnZXM7XG4gIH0sXG5cbiAgYXR0YWNoOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIG5vZGUuYXBwZW5kQ2hpbGQodGhpcy5ub2RlKTtcbiAgICByZXR1cm4gdGhpcy5yZW5kZXIoKTtcbiAgfSxcblxuICBzaG93TGlnaHRib3g6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgdmFyIGxpZ2h0Ym94ID0gdGhpcy5saWdodGJveDtcbiAgICB2YXIgaW1hZ2VzID0gdGhpcy5kYXRhLmltYWdlcztcbiAgICB2YXIgaW5kZXggPSBpbWFnZXMuaW5kZXhPZihkYXRhKTtcbiAgICB2YXIgbmV4dCA9IGluZGV4IDwgaW1hZ2VzLmxlbmd0aDtcbiAgICB2YXIgcHJldmlvdXMgPSBpbmRleCA+IDA7XG5cbiAgICBpZiAobGlnaHRib3gpIHtcbiAgICAgIGFzc2lnbihsaWdodGJveCwgeyBuZXh0OiBuZXh0LCBwcmV2aW91czogcHJldmlvdXMsIGRhdGE6IGRhdGEgfSk7XG4gICAgICBsaWdodGJveC5yZW5kZXIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlnaHRib3ggPSB0aGlzLmxpZ2h0Ym94ID0gbmV3IExpZ2h0Ym94KHsgbmV4dDogbmV4dCwgcHJldmlvdXM6IHByZXZpb3VzLCBkYXRhOiBkYXRhIH0pO1xuXG4gICAgICB0aGlzLmJpbmQobGlnaHRib3gsICdwcmV2b3VzJywgdGhpcy5vbkxpZ2h0Ym94UHJldmlvdXMpO1xuICAgICAgdGhpcy5iaW5kKGxpZ2h0Ym94LCAnbmV4dCcsIHRoaXMub25MaWdodGJveE5leHQpO1xuICAgICAgdGhpcy5iaW5kKGxpZ2h0Ym94LCAnY2xvc2UnLCB0aGlzLm9uTGlnaHRCb3hDbG9zZSk7XG5cbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobGlnaHRib3gucmVuZGVyKCkubm9kZSk7XG4gICAgfVxuICB9LFxuXG4gIHJlbW92ZTogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmxpZ2h0Ym94KSB7XG4gICAgICB0aGlzLnVuYmluZCh0aGlzLmxpZ2h0Ym94KTtcbiAgICAgIHRoaXMubGlnaHRib3gucmVtb3ZlKCk7XG4gICAgfVxuXG4gICAgQmFzZS5wcm90b3R5cGUucmVtb3ZlLmNhbGwodGhpcyk7XG4gIH0sXG5cbiAgLy9cbiAgLy8gTGlzdGVuZXJzXG5cbiAgb25HZXREYXRhOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmRhdGEgPSB7IGltYWdlczogdGhpcy5hZGFwdGVyLnBhcnNlKHJlc3BvbnNlKSB9O1xuXG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgfSxcblxuICBvbkltYWdlT3BlbjogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICB0aGlzLnNob3dMaWdodGJveChkYXRhKTtcbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBHYWxsZXJ5O1xuIiwidmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIEJhc2UgPSByZXF1aXJlKCcuL0Jhc2UnKTtcblxuXG52YXIgSW1hZ2UgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIEJhc2UuY2FsbCh0aGlzLCBvcHRpb25zKTtcbn07XG5cbkltYWdlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQmFzZS5wcm90b3R5cGUpO1xuSW1hZ2UucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gSW1hZ2U7XG5cbmFzc2lnbihJbWFnZS5wcm90b3R5cGUsIHtcbiAgY2xhc3NOYW1lOiAnb2NkbC1pbWFnZScsXG5cbiAgbGlzdGVuZXJzOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsaWNrOiB0aGlzLm9uQ2xpY2tcbiAgICB9O1xuICB9LFxuXG4gIHRlbXBsYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICc8aW1nIHNyYz1cIicsIHRoaXMudGh1bWIsICdcIj4nLFxuICAgICAgJzxzcGFuIGNsYXNzPVwibmFtZVwiPicsIHRoaXMubmFtZSwgJzwvc3Bhbj4nLFxuICAgICAgJzxhIGNsYXNzPVwiZXh0ZXJuYWxcIiB0YXJnZXQ9XCJfYmxhbmtcIiBocmVmPVwiJywgdGhpcy51cmwsICdcIj48L2E+J1xuICAgIF07XG4gIH0sXG5cbiAgLy9cbiAgLy8gTGlzdGVuZXJzXG5cbiAgb25DbGljazogZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgdGhpcy50cmlnZ2VyKCdvcGVuJywgdGhpcy5kYXRhKTtcbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBJbWFnZTtcbiIsIi8qIGVzbGludCBpbmRlbnQ6IFwib2ZmXCIgKi9cblxudmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIEJhc2UgPSByZXF1aXJlKCcuL0Jhc2UnKTtcblxuXG52YXIgTGlnaHRib3ggPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHRoaXMubmV4dCA9IG9wdGlvbnMubmV4dDtcbiAgdGhpcy5wcmV2aW91cyA9IG9wdGlvbnMucHJldmlvdXM7XG5cbiAgQmFzZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xufTtcblxuTGlnaHRib3gucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShCYXNlLnByb3RvdHlwZSk7XG5MaWdodGJveC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBMaWdodGJveDtcblxuYXNzaWduKExpZ2h0Ym94LnByb3RvdHlwZSwge1xuICBjbGFzc05hbWU6ICdvY2RsLWxpZ2h0Ym94JyxcblxuICBsaXN0ZW5lcnM6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgJ2NsaWNrIHByZXZpb3VzJzogdGhpcy5vblByZXZpb3VzQ2xpY2ssXG4gICAgICAnY2xpY2sgbmV4dCc6IHRoaXMub25OZXh0Q2xpY2tcbiAgICB9O1xuICB9LFxuXG4gIHRlbXBsYXRlOiBmdW5jdGlvbiAodmlldykge1xuICAgIHJldHVybiBbXG4gICAgICAnPGRpdiBjbGFzcz1cImxpZ2h0Ym94XCI+JyxcbiAgICAgICAgJzxoMiBjbGFzcz1cIm5hbWVcIj4nLCB0aGlzLm5hbWUsICc8L2gyPicsXG4gICAgICAgICc8aW1nIHNyYz1cIicsIHRoaXMudXJsLCAnXCI+JyxcbiAgICAgICAgJzxkaXYgY2xhc3M9XCJkZXNjcmlwdGlvblwiPicsXG4gICAgICAgICAgJzxwPicsIHRoaXMuZGVzY3JpcHRpb24sICc8L3A+JyxcbiAgICAgICAgJzwvZGl2PicsXG4gICAgICAgICc8YnV0dG9uIGNsYXNzPVwicHJldmlvdXNcIiBkYXRhLWV2ZW50LWlkPVwicHJldmlvdXNcIj4nLFxuICAgICAgICAnPGJ1dHRvbiBjbGFzcz1cIm5leHRcIiBkYXRhLWV2ZW50LWlkPVwibmV4dFwiPicsXG4gICAgICAgICc8YnV0dG9uIGNsYXNzPVwiY2xvc2VcIiBkYXRhLWV2ZW50LWlkPVwiY2xvc2VcIj4nLFxuICAgICAgJzwvZGl2PidcbiAgICBdO1xuICB9LFxuXG4gIC8vXG4gIC8vIExpc3RlbmVyc1xuXG4gIG9uUHJldmlvdXNDbGljazogZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgY29uc29sZS5sb2coJ3ByZXZpb3VzJyk7XG4gIH0sXG5cbiAgb25OZXh0Q2xpY2s6IGZ1bmN0aW9uIChldmVudCkge1xuICAgIGNvbnNvbGUubG9nKCduZXh0Jyk7XG4gIH1cbn0pO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gTGlnaHRib3g7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgR2FsbGVyeTogcmVxdWlyZSgnLi92aWV3cy9HYWxsZXJ5JyksXG4gIGltZ3VyOiByZXF1aXJlKCcuL3V0aWxzL2FkYXB0ZXJzL2ltZ3VyJylcbn07XG4iXX0=
