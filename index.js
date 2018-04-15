const fs = require('fs');
const Alexa = require('alexa-sdk');
const https = require('https');

const YelpClient = require('./yelp-client');

exports.handler = (event, context) => {
    const alexa = Alexa.handler(event, context);
    const data = fs.readFileSync('./secrets.json', 'utf8');

    alexa.appId = JSON.parse(data).alexaAppId;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function buildLocationString (location) {
    return `${location.address1} in ${location.city}`;
}

function metersToMiles (meters) {
    const miles = meters * 0.000621371;
    return Math.round(miles * 10) / 10;
}

const handlers = {
    'LaunchRequest': function () {
        this.emit('SearchRestaurant');
    },
    'SearchRestaurant': function () {
        //  Make sure user says a restaurant
        const restaurant = this.event.request.intent.slots.restaurant.value;
        if (!restaurant) {
            this.emit(':delegate', this.event.request.intent);
        } else {
            //  We're good to go
            YelpClient.yelpSearch(restaurant)
                .then((json) => {
                    const business = json.businesses[0];
                    this.response.speak(
                        `Your top result is ${business.name} located at ${buildLocationString(business.location)}. `
                        + `It is approximately ${metersToMiles(business.distance)} miles away.`
                    );
                    this.emit(':responseReady');
                })
                .catch(e => console.error(e));
        }
    },
    'AMAZON.HelpIntent': function () {
        this.response.speak('You can say something like look up burger king on yelp').listen('you wot mate?');
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        this.response.speak('Damn okay be like that');
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function () {
        this.response.speak('Damn okay be like that');
        this.emit(':responseReady');
    }
}
