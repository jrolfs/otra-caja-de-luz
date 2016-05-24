function Base(options) {
  this.test = options.test;
};

Object.assign(Base.prototype, {
  getTest: function () {
    return this.test;
  }
});

module.exports = Base;
