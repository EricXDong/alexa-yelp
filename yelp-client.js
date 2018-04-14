const fs = require('fs');
const fetch = require('isomorphic-fetch');
const https = require('https');

const data = fs.readFileSync('./secrets.json', 'utf8');
const json = JSON.parse(data);
const secrets = {
    yelpClientId: json.yelpClientId,
    yelpApiKey: json.yelpApiKey
};

function request (settings) {
    const headers = Object.assign({}, settings.headers, {
        Authorization: 'Bearer ' + secrets.yelpApiKey
    });
    return fetch(settings.url, {
        method: settings.method || 'GET',
        body: settings.body,
        headers
    });
}

function yelpSearch (query, location) {
    location = 'los angeles, ca';

    const searchEndpoint = 'https://api.yelp.com/v3/businesses/search';
    let url = searchEndpoint + '?';

    url += `term=${query}`;
    url += `&location=${location}`;
    url += `&limit=4`;

    return request({ url }).then(response => response.json());
}

exports.yelpSearch = yelpSearch;
