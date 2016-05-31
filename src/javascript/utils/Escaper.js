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
