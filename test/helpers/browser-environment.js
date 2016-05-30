global.document = require('jsdom').jsdom('<body></body>');
global.window = document.defaultView;
global.navigator = window.navigator;

// Polyfill Element.dataset for jsdom :(
// https://gist.github.com/dsheiko/37e4673cce20d5896510

function attrToDataKey(val) {
  var out = val.substr(5);

  return out.split('-').map(function(part, inx) {
    if (!inx) {
      return part;
    }

    return part.charAt(0).toUpperCase() + part.substr(1);
  }).join('');
}

function getNodeDataAttrs(el) {
  var attributes = el.attributes;

  var datasetMap = [];
  var proxy = {};

  var len = attributes.length;

  for (var i = 0; i < len; i++) {
    var attribute = attributes[i].nodeName;

    if (attribute.indexOf('data-') === 0) {
      var datakey = attrToDataKey(attribute);

      if (typeof datasetMap[datakey] !== 'undefined') {
        break;
      }

      datasetMap[datakey] = attributes[i].nodeValue;

      (function(datakey) {
        Object.defineProperty(proxy, datakey, {
          enumerable: true,
          configurable: true,
          get: function() {
            return  datasetMap[datakey];
          },
          set: function (val) {
            datasetMap[datakey] = val;
            el.setAttribute(attribute, val);
          }
        });
      })(datakey);
    }
  }

  return proxy;
};

Object.defineProperty(global.window.Element.prototype, 'dataset', {
  get: function () {
    return getNodeDataAttrs(this);
  }
});
