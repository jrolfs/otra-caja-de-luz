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
