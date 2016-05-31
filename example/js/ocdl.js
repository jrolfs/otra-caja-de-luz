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
      }.bind(this);
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

  this.lightbox = null
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
    }

    document.body.appendChild(lightbox.render().node);
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
  },

  onLightBoxClose: function () {
    this.lightbox.remove();
    this.lightbox = null;
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
          '<button class="previous" data-event-id="previous">Previous</button>',
        '</div>',
        '<div class="previous-container">',
          '<button class="next" data-event-id="next">Next</button>',
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
    console.log('previous');
  },

  onNextClick: function (event) {
    console.log('next');
  },

  onCloseClick: function (event) {
    this.trigger('close');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UtcG9seWZpbGwvcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9vYmplY3QtYXNzaWduL2luZGV4LmpzIiwic3JjL2phdmFzY3JpcHQvbWl4aW5zL0V2ZW50RW1pdHRlci5qcyIsInNyYy9qYXZhc2NyaXB0L3V0aWxzL0VzY2FwZXIuanMiLCJzcmMvamF2YXNjcmlwdC91dGlscy9hZGFwdGVycy9pbWd1ci5qcyIsInNyYy9qYXZhc2NyaXB0L3V0aWxzL2dldC5qcyIsInNyYy9qYXZhc2NyaXB0L3ZpZXdzL0Jhc2UuanMiLCJzcmMvamF2YXNjcmlwdC92aWV3cy9HYWxsZXJ5LmpzIiwic3JjL2phdmFzY3JpcHQvdmlld3MvSW1hZ2UuanMiLCJzcmMvamF2YXNjcmlwdC92aWV3cy9MaWdodGJveC5qcyIsInNyYy9qYXZhc2NyaXB0Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24oZ2xvYmFsKXtcblxuLy9cbi8vIENoZWNrIGZvciBuYXRpdmUgUHJvbWlzZSBhbmQgaXQgaGFzIGNvcnJlY3QgaW50ZXJmYWNlXG4vL1xuXG52YXIgTmF0aXZlUHJvbWlzZSA9IGdsb2JhbFsnUHJvbWlzZSddO1xudmFyIG5hdGl2ZVByb21pc2VTdXBwb3J0ZWQgPVxuICBOYXRpdmVQcm9taXNlICYmXG4gIC8vIFNvbWUgb2YgdGhlc2UgbWV0aG9kcyBhcmUgbWlzc2luZyBmcm9tXG4gIC8vIEZpcmVmb3gvQ2hyb21lIGV4cGVyaW1lbnRhbCBpbXBsZW1lbnRhdGlvbnNcbiAgJ3Jlc29sdmUnIGluIE5hdGl2ZVByb21pc2UgJiZcbiAgJ3JlamVjdCcgaW4gTmF0aXZlUHJvbWlzZSAmJlxuICAnYWxsJyBpbiBOYXRpdmVQcm9taXNlICYmXG4gICdyYWNlJyBpbiBOYXRpdmVQcm9taXNlICYmXG4gIC8vIE9sZGVyIHZlcnNpb24gb2YgdGhlIHNwZWMgaGFkIGEgcmVzb2x2ZXIgb2JqZWN0XG4gIC8vIGFzIHRoZSBhcmcgcmF0aGVyIHRoYW4gYSBmdW5jdGlvblxuICAoZnVuY3Rpb24oKXtcbiAgICB2YXIgcmVzb2x2ZTtcbiAgICBuZXcgTmF0aXZlUHJvbWlzZShmdW5jdGlvbihyKXsgcmVzb2x2ZSA9IHI7IH0pO1xuICAgIHJldHVybiB0eXBlb2YgcmVzb2x2ZSA9PT0gJ2Z1bmN0aW9uJztcbiAgfSkoKTtcblxuXG4vL1xuLy8gZXhwb3J0IGlmIG5lY2Vzc2FyeVxuLy9cblxuaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJyAmJiBleHBvcnRzKVxue1xuICAvLyBub2RlLmpzXG4gIGV4cG9ydHMuUHJvbWlzZSA9IG5hdGl2ZVByb21pc2VTdXBwb3J0ZWQgPyBOYXRpdmVQcm9taXNlIDogUHJvbWlzZTtcbiAgZXhwb3J0cy5Qb2x5ZmlsbCA9IFByb21pc2U7XG59XG5lbHNlXG57XG4gIC8vIEFNRFxuICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpXG4gIHtcbiAgICBkZWZpbmUoZnVuY3Rpb24oKXtcbiAgICAgIHJldHVybiBuYXRpdmVQcm9taXNlU3VwcG9ydGVkID8gTmF0aXZlUHJvbWlzZSA6IFByb21pc2U7XG4gICAgfSk7XG4gIH1cbiAgZWxzZVxuICB7XG4gICAgLy8gaW4gYnJvd3NlciBhZGQgdG8gZ2xvYmFsXG4gICAgaWYgKCFuYXRpdmVQcm9taXNlU3VwcG9ydGVkKVxuICAgICAgZ2xvYmFsWydQcm9taXNlJ10gPSBQcm9taXNlO1xuICB9XG59XG5cblxuLy9cbi8vIFBvbHlmaWxsXG4vL1xuXG52YXIgUEVORElORyA9ICdwZW5kaW5nJztcbnZhciBTRUFMRUQgPSAnc2VhbGVkJztcbnZhciBGVUxGSUxMRUQgPSAnZnVsZmlsbGVkJztcbnZhciBSRUpFQ1RFRCA9ICdyZWplY3RlZCc7XG52YXIgTk9PUCA9IGZ1bmN0aW9uKCl7fTtcblxuZnVuY3Rpb24gaXNBcnJheSh2YWx1ZSkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn1cblxuLy8gYXN5bmMgY2FsbHNcbnZhciBhc3luY1NldFRpbWVyID0gdHlwZW9mIHNldEltbWVkaWF0ZSAhPT0gJ3VuZGVmaW5lZCcgPyBzZXRJbW1lZGlhdGUgOiBzZXRUaW1lb3V0O1xudmFyIGFzeW5jUXVldWUgPSBbXTtcbnZhciBhc3luY1RpbWVyO1xuXG5mdW5jdGlvbiBhc3luY0ZsdXNoKCl7XG4gIC8vIHJ1biBwcm9taXNlIGNhbGxiYWNrc1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGFzeW5jUXVldWUubGVuZ3RoOyBpKyspXG4gICAgYXN5bmNRdWV1ZVtpXVswXShhc3luY1F1ZXVlW2ldWzFdKTtcblxuICAvLyByZXNldCBhc3luYyBhc3luY1F1ZXVlXG4gIGFzeW5jUXVldWUgPSBbXTtcbiAgYXN5bmNUaW1lciA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBhc3luY0NhbGwoY2FsbGJhY2ssIGFyZyl7XG4gIGFzeW5jUXVldWUucHVzaChbY2FsbGJhY2ssIGFyZ10pO1xuXG4gIGlmICghYXN5bmNUaW1lcilcbiAge1xuICAgIGFzeW5jVGltZXIgPSB0cnVlO1xuICAgIGFzeW5jU2V0VGltZXIoYXN5bmNGbHVzaCwgMCk7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBpbnZva2VSZXNvbHZlcihyZXNvbHZlciwgcHJvbWlzZSkge1xuICBmdW5jdGlvbiByZXNvbHZlUHJvbWlzZSh2YWx1ZSkge1xuICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcbiAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmVzb2x2ZXIocmVzb2x2ZVByb21pc2UsIHJlamVjdFByb21pc2UpO1xuICB9IGNhdGNoKGUpIHtcbiAgICByZWplY3RQcm9taXNlKGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGludm9rZUNhbGxiYWNrKHN1YnNjcmliZXIpe1xuICB2YXIgb3duZXIgPSBzdWJzY3JpYmVyLm93bmVyO1xuICB2YXIgc2V0dGxlZCA9IG93bmVyLnN0YXRlXztcbiAgdmFyIHZhbHVlID0gb3duZXIuZGF0YV87ICBcbiAgdmFyIGNhbGxiYWNrID0gc3Vic2NyaWJlcltzZXR0bGVkXTtcbiAgdmFyIHByb21pc2UgPSBzdWJzY3JpYmVyLnRoZW47XG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJylcbiAge1xuICAgIHNldHRsZWQgPSBGVUxGSUxMRUQ7XG4gICAgdHJ5IHtcbiAgICAgIHZhbHVlID0gY2FsbGJhY2sodmFsdWUpO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgcmVqZWN0KHByb21pc2UsIGUpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghaGFuZGxlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUpKVxuICB7XG4gICAgaWYgKHNldHRsZWQgPT09IEZVTEZJTExFRClcbiAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuXG4gICAgaWYgKHNldHRsZWQgPT09IFJFSkVDVEVEKVxuICAgICAgcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkge1xuICB2YXIgcmVzb2x2ZWQ7XG5cbiAgdHJ5IHtcbiAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBIHByb21pc2VzIGNhbGxiYWNrIGNhbm5vdCByZXR1cm4gdGhhdCBzYW1lIHByb21pc2UuJyk7XG5cbiAgICBpZiAodmFsdWUgJiYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSlcbiAgICB7XG4gICAgICB2YXIgdGhlbiA9IHZhbHVlLnRoZW47ICAvLyB0aGVuIHNob3VsZCBiZSByZXRyaXZlZCBvbmx5IG9uY2VcblxuICAgICAgaWYgKHR5cGVvZiB0aGVuID09PSAnZnVuY3Rpb24nKVxuICAgICAge1xuICAgICAgICB0aGVuLmNhbGwodmFsdWUsIGZ1bmN0aW9uKHZhbCl7XG4gICAgICAgICAgaWYgKCFyZXNvbHZlZClcbiAgICAgICAgICB7XG4gICAgICAgICAgICByZXNvbHZlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdmFsKVxuICAgICAgICAgICAgICByZXNvbHZlKHByb21pc2UsIHZhbCk7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAgICAgaWYgKCFyZXNvbHZlZClcbiAgICAgICAgICB7XG4gICAgICAgICAgICByZXNvbHZlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKCFyZXNvbHZlZClcbiAgICAgIHJlamVjdChwcm9taXNlLCBlKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlKHByb21pc2UsIHZhbHVlKXtcbiAgaWYgKHByb21pc2UgPT09IHZhbHVlIHx8ICFoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkpXG4gICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpe1xuICBpZiAocHJvbWlzZS5zdGF0ZV8gPT09IFBFTkRJTkcpXG4gIHtcbiAgICBwcm9taXNlLnN0YXRlXyA9IFNFQUxFRDtcbiAgICBwcm9taXNlLmRhdGFfID0gdmFsdWU7XG5cbiAgICBhc3luY0NhbGwocHVibGlzaEZ1bGZpbGxtZW50LCBwcm9taXNlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWplY3QocHJvbWlzZSwgcmVhc29uKXtcbiAgaWYgKHByb21pc2Uuc3RhdGVfID09PSBQRU5ESU5HKVxuICB7XG4gICAgcHJvbWlzZS5zdGF0ZV8gPSBTRUFMRUQ7XG4gICAgcHJvbWlzZS5kYXRhXyA9IHJlYXNvbjtcblxuICAgIGFzeW5jQ2FsbChwdWJsaXNoUmVqZWN0aW9uLCBwcm9taXNlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwdWJsaXNoKHByb21pc2UpIHtcbiAgdmFyIGNhbGxiYWNrcyA9IHByb21pc2UudGhlbl87XG4gIHByb21pc2UudGhlbl8gPSB1bmRlZmluZWQ7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcbiAgICBpbnZva2VDYWxsYmFjayhjYWxsYmFja3NbaV0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2hGdWxmaWxsbWVudChwcm9taXNlKXtcbiAgcHJvbWlzZS5zdGF0ZV8gPSBGVUxGSUxMRUQ7XG4gIHB1Ymxpc2gocHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2hSZWplY3Rpb24ocHJvbWlzZSl7XG4gIHByb21pc2Uuc3RhdGVfID0gUkVKRUNURUQ7XG4gIHB1Ymxpc2gocHJvbWlzZSk7XG59XG5cbi8qKlxuKiBAY2xhc3NcbiovXG5mdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKXtcbiAgaWYgKHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdQcm9taXNlIGNvbnN0cnVjdG9yIHRha2VzIGEgZnVuY3Rpb24gYXJndW1lbnQnKTtcblxuICBpZiAodGhpcyBpbnN0YW5jZW9mIFByb21pc2UgPT09IGZhbHNlKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ZhaWxlZCB0byBjb25zdHJ1Y3QgXFwnUHJvbWlzZVxcJzogUGxlYXNlIHVzZSB0aGUgXFwnbmV3XFwnIG9wZXJhdG9yLCB0aGlzIG9iamVjdCBjb25zdHJ1Y3RvciBjYW5ub3QgYmUgY2FsbGVkIGFzIGEgZnVuY3Rpb24uJyk7XG5cbiAgdGhpcy50aGVuXyA9IFtdO1xuXG4gIGludm9rZVJlc29sdmVyKHJlc29sdmVyLCB0aGlzKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBQcm9taXNlLFxuXG4gIHN0YXRlXzogUEVORElORyxcbiAgdGhlbl86IG51bGwsXG4gIGRhdGFfOiB1bmRlZmluZWQsXG5cbiAgdGhlbjogZnVuY3Rpb24ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pe1xuICAgIHZhciBzdWJzY3JpYmVyID0ge1xuICAgICAgb3duZXI6IHRoaXMsXG4gICAgICB0aGVuOiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihOT09QKSxcbiAgICAgIGZ1bGZpbGxlZDogb25GdWxmaWxsbWVudCxcbiAgICAgIHJlamVjdGVkOiBvblJlamVjdGlvblxuICAgIH07XG5cbiAgICBpZiAodGhpcy5zdGF0ZV8gPT09IEZVTEZJTExFRCB8fCB0aGlzLnN0YXRlXyA9PT0gUkVKRUNURUQpXG4gICAge1xuICAgICAgLy8gYWxyZWFkeSByZXNvbHZlZCwgY2FsbCBjYWxsYmFjayBhc3luY1xuICAgICAgYXN5bmNDYWxsKGludm9rZUNhbGxiYWNrLCBzdWJzY3JpYmVyKTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgIC8vIHN1YnNjcmliZVxuICAgICAgdGhpcy50aGVuXy5wdXNoKHN1YnNjcmliZXIpO1xuICAgIH1cblxuICAgIHJldHVybiBzdWJzY3JpYmVyLnRoZW47XG4gIH0sXG5cbiAgJ2NhdGNoJzogZnVuY3Rpb24ob25SZWplY3Rpb24pIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKTtcbiAgfVxufTtcblxuUHJvbWlzZS5hbGwgPSBmdW5jdGlvbihwcm9taXNlcyl7XG4gIHZhciBDbGFzcyA9IHRoaXM7XG5cbiAgaWYgKCFpc0FycmF5KHByb21pc2VzKSlcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIFByb21pc2UuYWxsKCkuJyk7XG5cbiAgcmV0dXJuIG5ldyBDbGFzcyhmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgdmFyIHJlbWFpbmluZyA9IDA7XG5cbiAgICBmdW5jdGlvbiByZXNvbHZlcihpbmRleCl7XG4gICAgICByZW1haW5pbmcrKztcbiAgICAgIHJldHVybiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICAgIHJlc3VsdHNbaW5kZXhdID0gdmFsdWU7XG4gICAgICAgIGlmICghLS1yZW1haW5pbmcpXG4gICAgICAgICAgcmVzb2x2ZShyZXN1bHRzKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDAsIHByb21pc2U7IGkgPCBwcm9taXNlcy5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICBwcm9taXNlID0gcHJvbWlzZXNbaV07XG5cbiAgICAgIGlmIChwcm9taXNlICYmIHR5cGVvZiBwcm9taXNlLnRoZW4gPT09ICdmdW5jdGlvbicpXG4gICAgICAgIHByb21pc2UudGhlbihyZXNvbHZlcihpKSwgcmVqZWN0KTtcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0c1tpXSA9IHByb21pc2U7XG4gICAgfVxuXG4gICAgaWYgKCFyZW1haW5pbmcpXG4gICAgICByZXNvbHZlKHJlc3VsdHMpO1xuICB9KTtcbn07XG5cblByb21pc2UucmFjZSA9IGZ1bmN0aW9uKHByb21pc2VzKXtcbiAgdmFyIENsYXNzID0gdGhpcztcblxuICBpZiAoIWlzQXJyYXkocHJvbWlzZXMpKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gUHJvbWlzZS5yYWNlKCkuJyk7XG5cbiAgcmV0dXJuIG5ldyBDbGFzcyhmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgcHJvbWlzZTsgaSA8IHByb21pc2VzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgIHByb21pc2UgPSBwcm9taXNlc1tpXTtcblxuICAgICAgaWYgKHByb21pc2UgJiYgdHlwZW9mIHByb21pc2UudGhlbiA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICBlbHNlXG4gICAgICAgIHJlc29sdmUocHJvbWlzZSk7XG4gICAgfVxuICB9KTtcbn07XG5cblByb21pc2UucmVzb2x2ZSA9IGZ1bmN0aW9uKHZhbHVlKXtcbiAgdmFyIENsYXNzID0gdGhpcztcblxuICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS5jb25zdHJ1Y3RvciA9PT0gQ2xhc3MpXG4gICAgcmV0dXJuIHZhbHVlO1xuXG4gIHJldHVybiBuZXcgQ2xhc3MoZnVuY3Rpb24ocmVzb2x2ZSl7XG4gICAgcmVzb2x2ZSh2YWx1ZSk7XG4gIH0pO1xufTtcblxuUHJvbWlzZS5yZWplY3QgPSBmdW5jdGlvbihyZWFzb24pe1xuICB2YXIgQ2xhc3MgPSB0aGlzO1xuXG4gIHJldHVybiBuZXcgQ2xhc3MoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICByZWplY3QocmVhc29uKTtcbiAgfSk7XG59O1xuXG59KSh0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnID8gd2luZG93IDogdHlwZW9mIGdsb2JhbCAhPSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9ICd1bmRlZmluZWQnID8gc2VsZiA6IHRoaXMpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuLyogZXNsaW50LWRpc2FibGUgbm8tdW51c2VkLXZhcnMgKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgcHJvcElzRW51bWVyYWJsZSA9IE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGU7XG5cbmZ1bmN0aW9uIHRvT2JqZWN0KHZhbCkge1xuXHRpZiAodmFsID09PSBudWxsIHx8IHZhbCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignT2JqZWN0LmFzc2lnbiBjYW5ub3QgYmUgY2FsbGVkIHdpdGggbnVsbCBvciB1bmRlZmluZWQnKTtcblx0fVxuXG5cdHJldHVybiBPYmplY3QodmFsKTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkVXNlTmF0aXZlKCkge1xuXHR0cnkge1xuXHRcdGlmICghT2JqZWN0LmFzc2lnbikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIERldGVjdCBidWdneSBwcm9wZXJ0eSBlbnVtZXJhdGlvbiBvcmRlciBpbiBvbGRlciBWOCB2ZXJzaW9ucy5cblxuXHRcdC8vIGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTQxMThcblx0XHR2YXIgdGVzdDEgPSBuZXcgU3RyaW5nKCdhYmMnKTsgIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0XHR0ZXN0MVs1XSA9ICdkZSc7XG5cdFx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRlc3QxKVswXSA9PT0gJzUnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MzA1NlxuXHRcdHZhciB0ZXN0MiA9IHt9O1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgMTA7IGkrKykge1xuXHRcdFx0dGVzdDJbJ18nICsgU3RyaW5nLmZyb21DaGFyQ29kZShpKV0gPSBpO1xuXHRcdH1cblx0XHR2YXIgb3JkZXIyID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVzdDIpLm1hcChmdW5jdGlvbiAobikge1xuXHRcdFx0cmV0dXJuIHRlc3QyW25dO1xuXHRcdH0pO1xuXHRcdGlmIChvcmRlcjIuam9pbignJykgIT09ICcwMTIzNDU2Nzg5Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGh0dHBzOi8vYnVncy5jaHJvbWl1bS5vcmcvcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTMwNTZcblx0XHR2YXIgdGVzdDMgPSB7fTtcblx0XHQnYWJjZGVmZ2hpamtsbW5vcHFyc3QnLnNwbGl0KCcnKS5mb3JFYWNoKGZ1bmN0aW9uIChsZXR0ZXIpIHtcblx0XHRcdHRlc3QzW2xldHRlcl0gPSBsZXR0ZXI7XG5cdFx0fSk7XG5cdFx0aWYgKE9iamVjdC5rZXlzKE9iamVjdC5hc3NpZ24oe30sIHRlc3QzKSkuam9pbignJykgIT09XG5cdFx0XHRcdCdhYmNkZWZnaGlqa2xtbm9wcXJzdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdC8vIFdlIGRvbid0IGV4cGVjdCBhbnkgb2YgdGhlIGFib3ZlIHRvIHRocm93LCBidXQgYmV0dGVyIHRvIGJlIHNhZmUuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2hvdWxkVXNlTmF0aXZlKCkgPyBPYmplY3QuYXNzaWduIDogZnVuY3Rpb24gKHRhcmdldCwgc291cmNlKSB7XG5cdHZhciBmcm9tO1xuXHR2YXIgdG8gPSB0b09iamVjdCh0YXJnZXQpO1xuXHR2YXIgc3ltYm9scztcblxuXHRmb3IgKHZhciBzID0gMTsgcyA8IGFyZ3VtZW50cy5sZW5ndGg7IHMrKykge1xuXHRcdGZyb20gPSBPYmplY3QoYXJndW1lbnRzW3NdKTtcblxuXHRcdGZvciAodmFyIGtleSBpbiBmcm9tKSB7XG5cdFx0XHRpZiAoaGFzT3duUHJvcGVydHkuY2FsbChmcm9tLCBrZXkpKSB7XG5cdFx0XHRcdHRvW2tleV0gPSBmcm9tW2tleV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMpIHtcblx0XHRcdHN5bWJvbHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKGZyb20pO1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzeW1ib2xzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChwcm9wSXNFbnVtZXJhYmxlLmNhbGwoZnJvbSwgc3ltYm9sc1tpXSkpIHtcblx0XHRcdFx0XHR0b1tzeW1ib2xzW2ldXSA9IGZyb21bc3ltYm9sc1tpXV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuIiwidmFyIEV2ZW50RW1pdHRlciA9IHtcbiAgb246IGZ1bmN0aW9uKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICB0aGlzLl9ldmVudHMgfHwgKHRoaXMuX2V2ZW50cyA9IHt9KTtcbiAgICB0aGlzLl9ldmVudHNbZXZlbnROYW1lXSA9IHRoaXMuX2V2ZW50c1tldmVudE5hbWVdIHx8IFtdO1xuXG4gICAgdGhpcy5fZXZlbnRzW2V2ZW50TmFtZV0ucHVzaCh7XG4gICAgICBjYWxsYmFjazogY2FsbGJhY2ssXG4gICAgICBjb250ZXh0OiBjb250ZXh0XG4gICAgfSk7XG4gIH0sXG5cbiAgb2ZmOiBmdW5jdGlvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMpIHJldHVybjtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgdmFyIGV2ZW50ID0gdGhpcy5fZXZlbnRzW2V2ZW50TmFtZV0gfHwgW107XG4gICAgICB2YXIgaSA9IGV2ZW50Lmxlbmd0aDtcblxuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBpZiAoY2FsbGJhY2sgPT09IGV2ZW50W2ldLmNhbGxiYWNrKSB7XG4gICAgICAgICAgZXZlbnQuc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbZXZlbnROYW1lXTtcbiAgICB9XG4gIH0sXG5cbiAgdHJpZ2dlcjogZnVuY3Rpb24oZXZlbnROYW1lKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMpIHJldHVybjtcblxuICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHZhciBldmVudHMgPSB0aGlzLl9ldmVudHNbZXZlbnROYW1lXTtcblxuICAgIGlmICghZXZlbnRzKSByZXR1cm47XG5cbiAgICBldmVudHMuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgZXZlbnQuY2FsbGJhY2suYXBwbHkoZXZlbnQuY29udGV4dCB8fCB0aGlzLCBhcmdzKTtcbiAgICB9LCB0aGlzKTtcbiAgfVxufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcbiIsInZhciBlc2NhcGVNYXAgPSB7XG4gICcmJzogJyZhbXA7JyxcbiAgJzwnOiAnJmx0OycsXG4gICc+JzogJyZndDsnLFxuICAnXCInOiAnJnF1b3Q7JyxcbiAgXCInXCI6ICcmI3gyNzsnLFxuICAnYCc6ICcmI3g2MDsnXG59O1xudmFyIG1hdGNoZXIgPSAnKD86JyArIE9iamVjdC5rZXlzKGVzY2FwZU1hcCkuam9pbignfCcpICsgJyknO1xudmFyIHRlc3RlciA9IG5ldyBSZWdFeHAobWF0Y2hlcik7XG52YXIgcmVwbGFjZXIgPSBuZXcgUmVnRXhwKG1hdGNoZXIsICdnJyk7XG5cbnZhciBlc2NhcGUgPSBmdW5jdGlvbihjb250ZW50KSB7XG4gIGNvbnRlbnQgPSAoY29udGVudCA9PSBudWxsKSA/ICcnIDogU3RyaW5nKGNvbnRlbnQpO1xuXG4gIGlmICh0ZXN0ZXIudGVzdChjb250ZW50KSkge1xuICAgIHJldHVybiBjb250ZW50LnJlcGxhY2UocmVwbGFjZXIsIGZ1bmN0aW9uIChtYXRjaCkge1xuICAgICAgcmV0dXJuIGVzY2FwZU1hcFttYXRjaF07XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGNvbnRlbnQ7XG4gIH1cbn07XG5cbnZhciBlc2NhcGVPYmplY3QgPSBmdW5jdGlvbiAoZGF0YSkge1xuICB2YXIgZXNjYXBlZERhdGEgPSB7fTtcblxuICBmb3IgKHZhciBrZXkgaW4gZGF0YSkge1xuICAgIHZhciB2YWx1ZSA9IGRhdGFba2V5XTtcbiAgICB2YXIgZXNjYXBlZFZhbHVlO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBlc2NhcGVkVmFsdWUgPSB2YWx1ZS5tYXAoZnVuY3Rpb24gKGl0ZW0pIHsgcmV0dXJuIGVzY2FwZU9iamVjdChpdGVtKTsgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICBlc2NhcGVkVmFsdWUgPSBlc2NhcGVPYmplY3QodmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlc2NhcGVkVmFsdWUgPSBlc2NhcGUodmFsdWUpO1xuICAgIH1cblxuICAgIGVzY2FwZWREYXRhW2tleV0gPSBlc2NhcGVkVmFsdWU7XG4gIH1cblxuICByZXR1cm4gZXNjYXBlZERhdGE7XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBlc2NhcGU6IGVzY2FwZSxcbiAgZXNjYXBlT2JqZWN0OiBlc2NhcGVPYmplY3Rcbn07XG4iLCJ2YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG5cbmZ1bmN0aW9uIGltZ3VyKG9wdGlvbnMpIHtcbiAgdGhpcy51cmwgPSB0aGlzLnJvb3QgKyBvcHRpb25zLnN1YiArICcuanNvbic7XG4gIHRoaXMuaGVhZGVycyA9IHsgJ0F1dGhvcml6YXRpb24nOiAnQ2xpZW50LUlEICcgKyBvcHRpb25zLmlkIH07XG5cbiAgcmV0dXJuIHRoaXM7XG59XG5cbmFzc2lnbihpbWd1ciwge1xuICByb290OiAnaHR0cHM6Ly9hcGkuaW1ndXIuY29tLzMvZ2FsbGVyeS9yLycsXG4gIHBhcnNlOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YS5tYXAoZnVuY3Rpb24gKGltYWdlKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBpbWFnZS50aXRsZSxcbiAgICAgICAgZGVzY3JpcHRpb246IGltYWdlLmRlc2NyaXB0aW9uIHx8ICcnLFxuICAgICAgICB1cmw6IGltYWdlLmxpbmssXG4gICAgICAgIHRodW1iOiBpbWFnZS5saW5rLnJlcGxhY2UoLyhcXC4ocG5nfGpwZ3xqcGVnKSkkLywgJ3QkMScpLFxuICAgICAgICB3aWR0aDogaW1hZ2Uud2lkdGgsXG4gICAgICAgIGhlaWdodDogaW1hZ2UuaGVpZ2h0XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGltZ3VyLmJpbmQoaW1ndXIpO1xuIiwidmFyIFByb21pc2UgPSByZXF1aXJlKCdlczYtcHJvbWlzZS1wb2x5ZmlsbCcpLlByb21pc2U7XG5cblxuZnVuY3Rpb24gZ2V0KHVybCwgaGVhZGVycykge1xuICBoZWFkZXJzIHx8IChoZWFkZXJzID0ge30pO1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgeGhyLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gaGVhZGVycykge1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCBoZWFkZXJzW2tleV0pO1xuICAgIH1cblxuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgIT09IDQpIHJldHVybjtcblxuICAgICAgaWYgKHhoci5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICByZXNvbHZlKEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVqZWN0KHtcbiAgICAgICAgICBzdGF0dXM6IHhoci5zdGF0dXMsXG4gICAgICAgICAgbWVzc2FnZTogeGhyLnN0YXR1c1RleHRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHhoci5zZW5kKCk7XG4gIH0pO1xufVxuXG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0O1xuIiwidmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL21peGlucy9FdmVudEVtaXR0ZXInKTtcbnZhciBlc2NhcGVPYmplY3QgPSByZXF1aXJlKCcuLi91dGlscy9Fc2NhcGVyJykuZXNjYXBlT2JqZWN0O1xuXG5cbmZ1bmN0aW9uIEJhc2Uob3B0aW9ucykge1xuICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuXG4gIHRoaXMubm9kZU5hbWUgPSBvcHRpb25zLm5vZGVOYW1lIHx8IHRoaXMubm9kZU5hbWUgfHwgJ2Rpdic7XG4gIHRoaXMuY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgdGhpcy5jbGFzc05hbWU7XG5cbiAgdGhpcy5kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuXG4gIHRoaXMuX2hhbmRsZXJzID0gW107XG4gIHRoaXMuX2NoaWxkcmVuID0gW107XG4gIHRoaXMuX2JpbmRpbmdzID0gW107XG5cbiAgdGhpcy5jcmVhdGVOb2RlKCk7XG4gIHRoaXMuYmluZExpc3RlbmVycygpO1xufTtcblxuYXNzaWduKEJhc2UucHJvdG90eXBlLCBFdmVudEVtaXR0ZXIpO1xuXG5hc3NpZ24oQmFzZS5wcm90b3R5cGUsIHtcbiAgY3JlYXRlTm9kZTogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMubm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGhpcy5ub2RlTmFtZSk7XG5cbiAgICBpZiAodGhpcy5ub2RlIGluc3RhbmNlb2YgSFRNTFVua25vd25FbGVtZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbm9kZU5hbWUgcHJvdmlkZWQnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5jbGFzc05hbWUpIHRoaXMubm9kZS5jbGFzc05hbWUgPSB0aGlzLmNsYXNzTmFtZTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIGJpbmRMaXN0ZW5lcnM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnMoKTtcbiAgICB2YXIgZGVsZWdhdGUgPSBmdW5jdGlvbiAoZXZlbnRJZCwgaGFuZGxlcikge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICBpZiAoZXZlbnQudGFyZ2V0LmRhdGFzZXQuZXZlbnRJZCAhPT0gZXZlbnRJZCkgcmV0dXJuO1xuXG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH0uYmluZCh0aGlzKTtcbiAgICB9O1xuXG4gICAgZm9yICh2YXIga2V5IGluIGxpc3RlbmVycykge1xuICAgICAgdmFyIGV2ZW50O1xuICAgICAgdmFyIGhhbmRsZXI7XG5cbiAgICAgIHZhciBsaXN0ZW5lciA9IGxpc3RlbmVyc1trZXldO1xuXG4gICAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3Qgc3VwcGx5IGEgdmFsaWQgZXZlbnQgbGlzdGVuZXInKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGtleS5tYXRjaCgvXFx3XFxzXFx3LykpIHtcbiAgICAgICAgdmFyIHBhcnRzID0ga2V5LnNwbGl0KC9cXHMvKTtcblxuICAgICAgICBldmVudCA9IHBhcnRzWzBdO1xuICAgICAgICBoYW5kbGVyID0gZGVsZWdhdGUuYmluZCh0aGlzLCBwYXJ0c1sxXSwgbGlzdGVuZXIpKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBldmVudCA9IGtleTtcbiAgICAgICAgaGFuZGxlciA9IGxpc3RlbmVyLmJpbmQodGhpcyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMubm9kZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyKTtcbiAgICAgIHRoaXMuX2hhbmRsZXJzLnB1c2goeyBldmVudDogZXZlbnQsIGhhbmRsZXI6IGhhbmRsZXIgfSk7XG4gICAgfVxuICB9LFxuXG4gIHVuYmluZExpc3RlbmVyczogZnVuY3Rpb24gKCkge1xuICAgIHdoaWxlICh0aGlzLl9oYW5kbGVycy5sZW5ndGgpIHtcbiAgICAgIHZhciBoYW5kbGVyID0gdGhpcy5faGFuZGxlcnMucG9wKCk7XG4gICAgICB0aGlzLm5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihoYW5kbGVyLmV2ZW50LCBoYW5kbGVyLmhhbmRsZXIpO1xuICAgIH1cbiAgfSxcblxuICBsaXN0ZW5lcnM6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge307XG4gIH0sXG5cbiAgdGVtcGxhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gW107XG4gIH0sXG5cbiAgYmluZDogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGhhbmRsZXIpIHtcbiAgICB0YXJnZXQub24oZXZlbnQsIGhhbmRsZXIsIHRoaXMpO1xuXG4gICAgdGhpcy5fYmluZGluZ3MucHVzaCh7IHRhcmdldDogdGFyZ2V0LCBldmVudDogZXZlbnQsIGhhbmRsZXI6IGhhbmRsZXIgfSk7XG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiAodGFyZ2V0LCBldmVudCwgaGFuZGxlcikge1xuICAgIHRoaXMuX2JpbmRpbmdzID0gdGhpcy5fYmluZGluZ3MuZmlsdGVyKGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICBpZiAoYmluZGluZy50YXJnZXQgPT09IHRhcmdldCkge1xuICAgICAgICBpZiAoZXZlbnQpIHtcbiAgICAgICAgICB0YXJnZXQub2ZmKGV2ZW50LCBoYW5kbGVyKTtcbiAgICAgICAgfSBlbHNlIGlmIChoYW5kbGVyKSB7XG4gICAgICAgICAgdGFyZ2V0Lm9mZihiaW5kaW5nLmV2ZW50LCBoYW5kbGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0YXJnZXQub2ZmKGJpbmRpbmcuZXZlbnQsIGJpbmRpbmcuaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBiaW5kaW5nO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIHVuYmluZEFsbDogZnVuY3Rpb24gKCkge1xuICAgIHdoaWxlICh0aGlzLl9iaW5kaW5ncy5sZW5ndGgpIHtcbiAgICAgIHZhciBiaW5kaW5nID0gdGhpcy5fYmluZGluZ3MucG9wKCk7XG4gICAgICBiaW5kaW5nLnRhcmdldC5vZmYoYmluZGluZy5ldmVudCk7XG4gICAgfVxuICB9LFxuXG4gIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgIHZhciB0ZW1wbGF0ZVBhcnRzID0gdGhpcy50ZW1wbGF0ZS5jYWxsKGVzY2FwZU9iamVjdCh0aGlzLmRhdGEpLCB0aGlzKTtcblxuICAgIGlmICghQXJyYXkuaXNBcnJheSh0ZW1wbGF0ZVBhcnRzKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUZW1wbGF0ZSBmdW5jdGlvbiBtdXN0IHJldHVybiBhbiBhcnJheScpO1xuICAgIH1cblxuICAgIHRoaXMuX2NoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkKSB7IHRoaXMudW5iaW5kKGNoaWxkKTsgfSwgdGhpcyk7XG4gICAgdGhpcy5yZW1vdmVDaGlsZHJlbigpO1xuXG4gICAgdGhpcy5ub2RlLmlubmVySFRNTCA9IHRlbXBsYXRlUGFydHMuam9pbignJyk7XG5cbiAgICBpZiAodHlwZW9mIHRoaXMuYWRkQ2hpbGRyZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuX2NoaWxkcmVuID0gdGhpcy5hZGRDaGlsZHJlbigpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIHJlbW92ZUNoaWxkcmVuOiBmdW5jdGlvbiAoKSB7XG4gICAgd2hpbGUgKHRoaXMuX2NoaWxkcmVuLmxlbmd0aCkgdGhpcy5fY2hpbGRyZW4ucG9wKCkucmVtb3ZlKCk7XG4gIH0sXG5cbiAgcmVtb3ZlOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy51bmJpbmRBbGwoKTtcbiAgICB0aGlzLnJlbW92ZUNoaWxkcmVuKCk7XG5cbiAgICBpZiAodHlwZW9mIHRoaXMubm9kZS5yZW1vdmUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMubm9kZS5yZW1vdmUoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMubm9kZS5wYXJlbnROb2RlKSB7XG4gICAgICB0aGlzLm5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLm5vZGUpO1xuICAgIH1cbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlO1xuIiwidmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIEJhc2UgPSByZXF1aXJlKCcuL0Jhc2UnKTtcbnZhciBJbWFnZSA9IHJlcXVpcmUoJy4vSW1hZ2UnKTtcbnZhciBMaWdodGJveCA9IHJlcXVpcmUoJy4vTGlnaHRib3gnKTtcbnZhciBnZXQgPSByZXF1aXJlKCcuLi91dGlscy9nZXQnKTtcblxuXG52YXIgR2FsbGVyeSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgdmFyIGFkYXB0ZXIgPSB0aGlzLmFkYXB0ZXIgPSBvcHRpb25zLmFkYXB0ZXI7XG5cbiAgdGhpcy5saWdodGJveCA9IG51bGxcbiAgdGhpcy5sb2FkaW5nID0gdHJ1ZTtcbiAgdGhpcy5pbmRleCA9IC0xO1xuXG4gIGdldChhZGFwdGVyLnVybCwgYWRhcHRlci5oZWFkZXJzKS50aGVuKHRoaXMub25HZXREYXRhLmJpbmQodGhpcykpO1xuXG4gIEJhc2UuY2FsbCh0aGlzLCBvcHRpb25zKTtcbn07XG5cbkdhbGxlcnkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShCYXNlLnByb3RvdHlwZSk7XG5HYWxsZXJ5LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEdhbGxlcnk7XG5cbmFzc2lnbihHYWxsZXJ5LnByb3RvdHlwZSwge1xuICBjbGFzc05hbWU6ICdvY2RsLWdhbGxlcnknLFxuXG4gIHRlbXBsYXRlOiBmdW5jdGlvbiAodmlldykge1xuICAgIHJldHVybiB2aWV3LmxvYWRpbmcgPyBbJzxkaXYgY2xhc3M9XCJsb2FkaW5nXCI+PC9kaXY+J10gOiBbXTtcbiAgfSxcblxuICBhZGRDaGlsZHJlbjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmxvYWRpbmcpIHJldHVybiBbXTtcblxuICAgIHZhciBpbWFnZXMgPSB0aGlzLmRhdGEuaW1hZ2VzLm1hcChmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgcmV0dXJuIG5ldyBJbWFnZSh7IGRhdGE6IGRhdGEgfSkucmVuZGVyKCk7XG4gICAgfSk7XG5cbiAgICBpbWFnZXMuZm9yRWFjaChmdW5jdGlvbiAodmlldykge1xuICAgICAgdGhpcy5iaW5kKHZpZXcsICdvcGVuJywgdGhpcy5vbkltYWdlT3Blbik7XG4gICAgICB0aGlzLm5vZGUuYXBwZW5kQ2hpbGQodmlldy5ub2RlKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHJldHVybiBpbWFnZXM7XG4gIH0sXG5cbiAgYXR0YWNoOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIG5vZGUuYXBwZW5kQ2hpbGQodGhpcy5ub2RlKTtcbiAgICByZXR1cm4gdGhpcy5yZW5kZXIoKTtcbiAgfSxcblxuICBzaG93TGlnaHRib3g6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgdmFyIGxpZ2h0Ym94ID0gdGhpcy5saWdodGJveDtcbiAgICB2YXIgaW1hZ2VzID0gdGhpcy5kYXRhLmltYWdlcztcbiAgICB2YXIgaW5kZXggPSBpbWFnZXMuaW5kZXhPZihkYXRhKTtcbiAgICB2YXIgbmV4dCA9IGluZGV4IDwgaW1hZ2VzLmxlbmd0aDtcbiAgICB2YXIgcHJldmlvdXMgPSBpbmRleCA+IDA7XG5cbiAgICBpZiAobGlnaHRib3gpIHtcbiAgICAgIGFzc2lnbihsaWdodGJveCwgeyBuZXh0OiBuZXh0LCBwcmV2aW91czogcHJldmlvdXMsIGRhdGE6IGRhdGEgfSk7XG4gICAgICBsaWdodGJveC5yZW5kZXIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlnaHRib3ggPSB0aGlzLmxpZ2h0Ym94ID0gbmV3IExpZ2h0Ym94KHsgbmV4dDogbmV4dCwgcHJldmlvdXM6IHByZXZpb3VzLCBkYXRhOiBkYXRhIH0pO1xuXG4gICAgICB0aGlzLmJpbmQobGlnaHRib3gsICdwcmV2b3VzJywgdGhpcy5vbkxpZ2h0Ym94UHJldmlvdXMpO1xuICAgICAgdGhpcy5iaW5kKGxpZ2h0Ym94LCAnbmV4dCcsIHRoaXMub25MaWdodGJveE5leHQpO1xuICAgICAgdGhpcy5iaW5kKGxpZ2h0Ym94LCAnY2xvc2UnLCB0aGlzLm9uTGlnaHRCb3hDbG9zZSk7XG4gICAgfVxuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsaWdodGJveC5yZW5kZXIoKS5ub2RlKTtcbiAgfSxcblxuICByZW1vdmU6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5saWdodGJveCkge1xuICAgICAgdGhpcy51bmJpbmQodGhpcy5saWdodGJveCk7XG4gICAgICB0aGlzLmxpZ2h0Ym94LnJlbW92ZSgpO1xuICAgIH1cblxuICAgIEJhc2UucHJvdG90eXBlLnJlbW92ZS5jYWxsKHRoaXMpO1xuICB9LFxuXG4gIC8vXG4gIC8vIExpc3RlbmVyc1xuXG4gIG9uR2V0RGF0YTogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgdGhpcy5sb2FkaW5nID0gZmFsc2U7XG4gICAgdGhpcy5kYXRhID0geyBpbWFnZXM6IHRoaXMuYWRhcHRlci5wYXJzZShyZXNwb25zZSkgfTtcblxuICAgIHRoaXMucmVuZGVyKCk7XG4gIH0sXG5cbiAgb25JbWFnZU9wZW46IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgdGhpcy5zaG93TGlnaHRib3goZGF0YSk7XG4gIH0sXG5cbiAgb25MaWdodEJveENsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5saWdodGJveC5yZW1vdmUoKTtcbiAgICB0aGlzLmxpZ2h0Ym94ID0gbnVsbDtcbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBHYWxsZXJ5O1xuIiwidmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIEJhc2UgPSByZXF1aXJlKCcuL0Jhc2UnKTtcblxuXG52YXIgSW1hZ2UgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIEJhc2UuY2FsbCh0aGlzLCBvcHRpb25zKTtcbn07XG5cbkltYWdlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQmFzZS5wcm90b3R5cGUpO1xuSW1hZ2UucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gSW1hZ2U7XG5cbmFzc2lnbihJbWFnZS5wcm90b3R5cGUsIHtcbiAgY2xhc3NOYW1lOiAnb2NkbC1pbWFnZScsXG5cbiAgbGlzdGVuZXJzOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsaWNrOiB0aGlzLm9uQ2xpY2tcbiAgICB9O1xuICB9LFxuXG4gIHRlbXBsYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICc8aW1nIHNyYz1cIicsIHRoaXMudGh1bWIsICdcIj4nLFxuICAgICAgJzxzcGFuIGNsYXNzPVwibmFtZVwiPicsIHRoaXMubmFtZSwgJzwvc3Bhbj4nLFxuICAgICAgJzxhIGNsYXNzPVwiZXh0ZXJuYWxcIiB0YXJnZXQ9XCJfYmxhbmtcIiBocmVmPVwiJywgdGhpcy51cmwsICdcIj48L2E+J1xuICAgIF07XG4gIH0sXG5cbiAgLy9cbiAgLy8gTGlzdGVuZXJzXG5cbiAgb25DbGljazogZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgdGhpcy50cmlnZ2VyKCdvcGVuJywgdGhpcy5kYXRhKTtcbiAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBJbWFnZTtcbiIsIi8qIGVzbGludCBpbmRlbnQ6IFwib2ZmXCIgKi9cblxudmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxudmFyIEJhc2UgPSByZXF1aXJlKCcuL0Jhc2UnKTtcblxuXG52YXIgTGlnaHRib3ggPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHRoaXMubmV4dCA9IG9wdGlvbnMubmV4dDtcbiAgdGhpcy5wcmV2aW91cyA9IG9wdGlvbnMucHJldmlvdXM7XG5cbiAgdGhpcy5vbkJvZHlLZXl1cCA9IHRoaXMub25Cb2R5S2V5dXAuYmluZCh0aGlzKTtcblxuICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5vbkJvZHlLZXl1cCk7XG5cbiAgQmFzZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xufTtcblxuTGlnaHRib3gucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShCYXNlLnByb3RvdHlwZSk7XG5MaWdodGJveC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBMaWdodGJveDtcblxuYXNzaWduKExpZ2h0Ym94LnByb3RvdHlwZSwge1xuICBjbGFzc05hbWU6ICdvY2RsLWxpZ2h0Ym94JyxcblxuICBsaXN0ZW5lcnM6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgJ2NsaWNrIHByZXZpb3VzJzogdGhpcy5vblByZXZpb3VzQ2xpY2ssXG4gICAgICAnY2xpY2sgbmV4dCc6IHRoaXMub25OZXh0Q2xpY2ssXG4gICAgICAnY2xpY2sgY2xvc2UnOiB0aGlzLm9uQ2xvc2VDbGlja1xuICAgIH07XG4gIH0sXG5cbiAgdGVtcGxhdGU6IGZ1bmN0aW9uICh2aWV3KSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICc8ZGl2IGNsYXNzPVwibGlnaHRib3hcIj4nLFxuICAgICAgICAnPGgyIGNsYXNzPVwibmFtZVwiPicsIHRoaXMubmFtZSwgJzwvaDI+JyxcbiAgICAgICAgJzxpbWcgc3JjPVwiJywgdGhpcy51cmwsICdcIj4nLFxuICAgICAgICAnPGRpdiBjbGFzcz1cImRlc2NyaXB0aW9uXCI+JyxcbiAgICAgICAgICAnPHA+JywgdGhpcy5kZXNjcmlwdGlvbiwgJzwvcD4nLFxuICAgICAgICAnPC9kaXY+JyxcbiAgICAgICAgJzxkaXYgY2xhc3M9XCJwcmV2aW91cy1jb250YWluZXJcIj4nLFxuICAgICAgICAgICc8YnV0dG9uIGNsYXNzPVwicHJldmlvdXNcIiBkYXRhLWV2ZW50LWlkPVwicHJldmlvdXNcIj5QcmV2aW91czwvYnV0dG9uPicsXG4gICAgICAgICc8L2Rpdj4nLFxuICAgICAgICAnPGRpdiBjbGFzcz1cInByZXZpb3VzLWNvbnRhaW5lclwiPicsXG4gICAgICAgICAgJzxidXR0b24gY2xhc3M9XCJuZXh0XCIgZGF0YS1ldmVudC1pZD1cIm5leHRcIj5OZXh0PC9idXR0b24+JyxcbiAgICAgICAgJzwvZGl2PicsXG4gICAgICAgICc8YnV0dG9uIGNsYXNzPVwiY2xvc2VcIiBkYXRhLWV2ZW50LWlkPVwiY2xvc2VcIj48L2J1dHRvbj4nLFxuICAgICAgJzwvZGl2PidcbiAgICBdO1xuICB9LFxuXG4gIHJlbW92ZTogZnVuY3Rpb24gKCkge1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLm9uQm9keUtleXVwKTtcblxuICAgIEJhc2UucHJvdG90eXBlLnJlbW92ZS5jYWxsKHRoaXMpO1xuICB9LFxuXG4gIC8vXG4gIC8vIExpc3RlbmVyc1xuICBcbiAgb25Cb2R5S2V5dXA6IGZ1bmN0aW9uIChldmVudCkge1xuICAgIGlmIChldmVudC53aGljaCA9PT0gMjcpIHRoaXMudHJpZ2dlcignY2xvc2UnKTtcbiAgfSxcblxuICBvblByZXZpb3VzQ2xpY2s6IGZ1bmN0aW9uIChldmVudCkge1xuICAgIGNvbnNvbGUubG9nKCdwcmV2aW91cycpO1xuICB9LFxuXG4gIG9uTmV4dENsaWNrOiBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICBjb25zb2xlLmxvZygnbmV4dCcpO1xuICB9LFxuXG4gIG9uQ2xvc2VDbGljazogZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgdGhpcy50cmlnZ2VyKCdjbG9zZScpO1xuICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IExpZ2h0Ym94O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIEdhbGxlcnk6IHJlcXVpcmUoJy4vdmlld3MvR2FsbGVyeScpLFxuICBpbWd1cjogcmVxdWlyZSgnLi91dGlscy9hZGFwdGVycy9pbWd1cicpXG59O1xuIl19
