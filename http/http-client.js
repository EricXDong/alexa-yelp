const fetch = require('isomorphic-fetch');

function httpRequest (settings, bearerToken) {
    if (bearerToken) {
        settings.headers = Object.assign({}, settings.headers, {
            Authorization: 'Bearer ' + bearerToken
        });
    }
    return fetch(settings.url, {
        method: settings.method || 'GET',
        body: settings.body,
        headers: settings.headers
    });
}

module.exports = httpRequest;
