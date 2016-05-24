var assign = require('object-assign');


function Base(options) {
  options || (options = {});

  this.nodeName = options.nodeName || this.nodeName || 'div';

  this.createNode();
};

assign(Base.prototype, {
  createNode: function () {
    this.node = document.createElement(this.nodeName);

    return this;
  }
});

module.exports = Base;
