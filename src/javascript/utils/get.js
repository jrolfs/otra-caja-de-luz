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
