const fs = require('fs');
const Alexa = require('alexa-sdk');

const YelpClient = require('./http/yelp-client');
const AWSClient = require('./http/aws-client');
const Logger = require('./logger');

const logger = new Logger('Alexa-Yelp');

let validateAppId = (correctId, event) => new Promise((resolve, reject) => {
    const id = event.session.application.applicationId;
    if (correctId === id) {
        resolve(id);
    } else {
        reject(id);
    }
});

exports.handler = (event, context) => {
    const alexa = Alexa.handler(event, context);
    const data = fs.readFileSync('./secrets.json', 'utf8');

    alexa.appId = JSON.parse(data).alexaAppId;
    validateAppId = validateAppId.bind(null, alexa.appId);
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

const customHandlers = {
    searchRestaurant: 'SearchRestaurant',
    requestPermission: 'RequestPermission',
    error: 'Error'
};

const handlers = {
    'LaunchRequest': function () {
        validateAppId(this.event)
            .then(() => this.emit(customHandlers.searchRestaurant))
            .catch((id) => this.emit(
                customHandlers.error,
                'I was unable to validate your application ID',
                { code: '401', message: `Invalid application ID: ${id}` }
            ));
    },

    [customHandlers.searchRestaurant]: function () {
        validateAppId(this.event)
            .then(() => {
                //  Make sure user says a restaurant
                const restaurant = this.event.request.intent.slots.restaurant.value;
                if (!restaurant) {
                    logger.logJsonMessage({
                        userId: this.event.session.user.userId,
                        query: 'Requesting restaurant'
                    });
                    this.emit(':delegate', this.event.request.intent);
                } else {
                    //  Good to go, get user's location
                    const awsClient = new AWSClient(
                        this.event.context.System.apiAccessToken,
                        this.event.context.System.device.deviceId,
                        this.event.context.System.apiEndpoint
                    );
                    awsClient.getDeviceAddress()
                        .then((response) => {
                            response = {
                                stateOrRegion: 'CA',
                                city: 'Los Angeles',
                                countryCode: 'US',
                                postalCode: '90015',
                                addressLine1: '1355 South Flower St'
                            };
                            if (response.type && response.type.toLowerCase() === 'forbidden') {
                                //  Need to get permission to access location
                                logger.logJsonMessage({
                                    userId: this.event.session.user.userId,
                                    query: restaurant,
                                    location: 'Requesting permission'
                                });
                                this.emit(customHandlers.requestPermission);
                            } else {
                                return response;
                            }
                        })
                        .then((address) => {
                            const location = `${address.addressLine1}, ${address.city}, `
                                + `${address.stateOrRegion || address.postalCode}`;

                            logger.logJsonMessage({
                                userId: this.event.session.user.userId,
                                query: restaurant,
                                location
                            });

                            YelpClient.yelpSearch(restaurant, location)
                                .then((data) => {
                                    const business = data.businesses[0];
                                    this.response.speak(
                                        `Your top result is ${business.name} located at `
                                        + `${buildLocationString(business.location)}. `
                                        + `It is approximately ${metersToMiles(business.distance)} miles away.`
                                    );
                                    this.emit(':responseReady');
                                })
                                .catch(e => this.emit(
                                    customHandlers.error,
                                    `I had a problem searching for ${restaurant}`,
                                    e
                                ));
                        });
                }
            })
            .catch((id) => this.emit(
                customHandlers.error,
                'I was unable to validate your application ID',
                { code: '401', message: `Invalid application ID: ${id}` }
            ));
    },

    [customHandlers.requestPermission]: function () {
        this.handler.response = buildAlexaResponse({
            card: {
                type: 'AskForPermissionsConsent',
                permissions: [ 'read::alexa:device:all:address' ]
            },
            shouldEndSession: false
        });
        this.emit(':responseReady');
    },

    [customHandlers.error]: function (message, e) {
        logger.logError(`${e.code}: ${e.message}`);
        this.response.speak(`Sorry, something went wrong. ${message}`);

    },

    'AMAZON.HelpIntent': function () {
        this.response.speak('You can say something like: look up burger king using yelp');
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
};

function buildAlexaResponse (settings) {
    const alexaResponse = {
        body: {
            version: settings.version || '1.0',
            sessionAttributes: settings.sessionAttributes || {},
            response: {
                shouldEndSession: false
            }
        }
    };

    if (settings.card) {
        alexaResponse.body.response.card = settings.card;
    }

    if (settings.shouldEndSession) {
        alexaResponse.body.response.shouldEndSession = settings.shouldEndSession;
    }

    return alexaResponse;
}
