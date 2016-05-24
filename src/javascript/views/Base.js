function Base(options) {
  options || (options = {});

  this.nodeName = options.nodeName || this.nodeName || 'div';

  this.createNode();
};

Object.assign(Base.prototype, {
  createNode: function () {
    this.node = document.createElement(this.nodeName);

    return this;
  }
});

module.exports = Base;
