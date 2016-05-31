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
