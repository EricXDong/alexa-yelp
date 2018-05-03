const fs = require('fs');
const Alexa = require('alexa-sdk');

const YelpClient = require('./http/yelp-client');
const AWSClient = require('./http/aws-client');
const Logger = require('./logger');

const logger = new Logger('Alexa-Yelp');

const secrets = JSON.parse(fs.readFileSync('./secrets.json', 'utf8'));

let validateAppId = (event) => new Promise((resolve, reject) => {
    const id = event.session.application.applicationId;
    if (secrets.alexaAppId === id) {
        resolve(id);
    } else {
        reject(id);
    }
});

exports.handler = (event, context) => {
    const alexa = Alexa.handler(event, context);
    alexa.appId = secrets.alexaAppId;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function buildLocationString (location) {
    return `${location.address1}, ${location.city}`;
}

function metersToMiles (meters) {
    const miles = meters * 0.000621371;
    return Math.round(miles * 10) / 10;
}

function buildBusinessCardText (business, listPosition) {
    return `${listPosition}. ${business.name} (${metersToMiles(business.distance)} mi)\n`
        + `[${business.rating}/5 stars] ${business.review_count} review${business.review_count > 1 ? 's' : ''}\n`
        + `${buildLocationString(business.location)}\n`;
}

const customHandlers = {
    searchRestaurant: 'SearchRestaurant',
    requestPermission: 'RequestPermission',
    error: 'Error'
};

const handlers = {
    'LaunchRequest': function () {
        validateAppId(this.event).then(() => {
            this.response
                .speak('Welcome to Yelp for Alexa. Just let me know what you would like to search for.')
                .listen('You can say something like: Alexa, find McDonald\'s using Yelp Search.');
            this.emit(':responseReady');
        }).catch((id) => this.emit(
            customHandlers.error,
            'I was unable to validate your application ID.',
            { code: '401', message: `Invalid application ID: ${id}` }
        ));
    },

    [customHandlers.searchRestaurant]: function () {
        validateAppId(this.event).then(() => {
            //  Make sure user says a restaurant
            const restaurant = this.event.request.intent.slots.restaurant.value;
            if (!restaurant) {
                logger.logJsonMessage({
                    userId: this.event.session.user.userId,
                    query: 'Requesting restaurant'
                });
                this.emit(':delegate', this.event.request.intent);
                return;
            }

            //  Good to go, get user's location
            const awsClient = new AWSClient(
                this.event.context.System.apiAccessToken,
                this.event.context.System.device.deviceId,
                this.event.context.System.apiEndpoint
            );
            return awsClient.getDeviceAddress().then((json) => {
                // json = {
                //     stateOrRegion: 'CA',
                //     city: 'Los Angeles',
                //     countryCode: 'US',
                //     postalCode: '90015',
                //     addressLine1: '1355 South Flower St'
                // };
                if (json.type && json.type.toLowerCase() === 'forbidden') {
                    //  Need to get permission to access location
                    logger.logJsonMessage({
                        userId: this.event.session.user.userId,
                        query: restaurant,
                        location: 'Requesting permission'
                    });
                    this.emit(customHandlers.requestPermission);
                    return;
                }

                const userLocation = `${json.addressLine1}, ${json.city}, `
                    + `${json.stateOrRegion || json.postalCode}`;
                logger.logJsonMessage({
                    userId: this.event.session.user.userId,
                    query: restaurant,
                    userLocation
                });

                //  Search and return results
                return YelpClient.yelpSearch(restaurant, userLocation).then((data) => {
                    //  Check for no results
                    if (data.businesses.length === 0) {
                        this.response.speak(`Sorry, I couldn't find any results for ${restaurant}.`);
                        this.emit(':responseReady');
                        return;
                    }

                    const topResult = data.businesses[0];
                    const topResultSpeech = `Your top result is ${topResult.name}, 
                        about ${metersToMiles(topResult.distance)} miles away. It has ${topResult.rating} stars with 
                        ${topResult.review_count} reviews.`;

                    //  Build a card with top 5 results
                    const card = {
                        type: 'Standard',
                        title: 'Yelp Results',
                        image: {
                            smallImageUrl: topResult.image_url,
                            largeImageUrl: topResult.image_url
                        },
                        text: data.businesses
                            .slice(0, 5)
                            .map((business, i) => buildBusinessCardText(business, i + 1))
                            .join('\n')
                    };

                    //  Respond with card and dialogue
                    this.handler.response = buildAlexaResponse({
                        card,
                        outputSpeech: {
                            type: 'SSML',
                            ssml: `<speak>
                                <p> ${topResultSpeech}</p>
                                <p>
                                    I've displayed the rest of your results, including further details, on a card
                                    in the Alexa App.
                                </p>
                            </speak>`
                        }
                    });
                    this.emit(':responseReady');
                }).catch(e => this.emit(
                    customHandlers.error,
                    `I had a problem searching for ${restaurant}.`,
                    e
                ));
            });
        }).catch((id) => this.emit(
            customHandlers.error,
            'I was unable to validate your application ID.',
            { code: '401', message: `Invalid application ID: ${id}` }
        ));
    },

    [customHandlers.requestPermission]: function () {
        this.handler.response = buildAlexaResponse({
            card: {
                type: 'AskForPermissionsConsent',
                permissions: [ 'read::alexa:device:all:address' ]
            },
            outputSpeech: {
                type: 'SSML',
                ssml: `<speak> I need to know your location in order to return relevant results. You can give `
                    + `me permission in the Alexa App. </speak>`
            },
            shouldEndSession: false
        });
        this.emit(':responseReady');
    },

    [customHandlers.error]: function (message, e) {
        logger.logError(`${e.code}: ${e.message || e.description}`);
        this.response.speak(`Sorry, something went wrong. ${message}`);
        this.emit(':responseReady');
    },

    'AMAZON.HelpIntent': function () {
        this.response.speak('You can say something like: look up burger king using yelp');
        this.emit(':responseReady');
    },

    'AMAZON.CancelIntent': function () {
        this.response.speak('Goodbye');
        this.emit(':responseReady');
    },

    'AMAZON.StopIntent': function () {
        this.response.speak('Goodbye');
        this.emit(':responseReady');
    }
};

function buildAlexaResponse (settings) {
    const alexaResponse = {
        version: settings.version || '1.0',
        sessionAttributes: settings.sessionAttributes || {},
        response: {
            shouldEndSession: true
        }
    };

    if (settings.card) {
        alexaResponse.response.card = settings.card;
    }

    if (settings.shouldEndSession !== null && settings.shouldEndSession !== undefined) {
        alexaResponse.response.shouldEndSession = settings.shouldEndSession;
    }

    if (settings.outputSpeech) {
        alexaResponse.response.outputSpeech = settings.outputSpeech;
    }

    return alexaResponse;
}
