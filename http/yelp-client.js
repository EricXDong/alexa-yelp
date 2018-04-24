const fs = require('fs');

const httpRequest = require('./http-client');

const data = fs.readFileSync('./secrets.json', 'utf8');
const json = JSON.parse(data);
const secrets = {
    yelpClientId: json.yelpClientId,
    yelpApiKey: json.yelpApiKey
};

function yelpRequest (url) {
    return httpRequest({ url }, secrets.yelpApiKey);
}

function yelpSearch (query, location) {
    const searchEndpoint = 'https://api.yelp.com/v3/businesses/search';
    let url = searchEndpoint + '?';

    url += `term=${query}`;
    url += `&location=${location}`;
    url += `&limit=4`;

    return yelpRequest(url)
        .then(response => response.json())
        .then((json) => {
            if (json.error) {
                throw json.error;
            }
            return json;
        });
}

exports.yelpSearch = yelpSearch;
