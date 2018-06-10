const fs = require('fs');
const Alexa = require('ask-sdk-core');

const YelpClient = require('./http/yelp-client');
const AWSClient = require('./http/aws-client');
const Logger = require('./logger');

const logger = new Logger('Alexa-Yelp');

const secrets = JSON.parse(fs.readFileSync('./secrets.json', 'utf8'));

let validateAppId = (session) => new Promise((resolve, reject) => {
    const id = session.application.applicationId;
    if (secrets.alexaAppId === id) {
        resolve(id);
    } else {
        reject(id);
    }
});

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

function replaceAmpersandBcAlexaIsALittleShit (text) {
    return text.replace(/&/g, 'and');
}

function isIntentRequest (handlerInput, intent) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === intent;
}

const handlerTypes = {
    launch: 'LaunchRequest',
    searchRestaurant: 'SearchRestaurant',
    help: 'AMAZON.HelpIntent',
    cancel: 'AMAZON.CancelIntent',
    stop: 'AMAZON.StopIntent'
};

const launchRequestHandler = {
    canHandle (handlerInput) {
        return handlerInput.requestEnvelope.request.type === handlerTypes.launch;
    },
    handle (handlerInput) {
        return validateAppId(handlerInput.requestEnvelope.session)
            .then(() => handlerInput.responseBuilder
                .speak('Welcome to Yelp for Alexa. Just let me know what you would like to search for.')
                .withShouldEndSession(false)
                .getResponse()
            )
            .catch((id) => {
                throw {
                    response: 'I was unable to validate your application.',
                    code: '401',
                    message: `Invalid application ID: ${id}`
                };
            });
    }
};

const searchHandler = {
    canHandle (handlerInput) {
        return isIntentRequest(handlerInput, handlerTypes.searchRestaurant);
    },
    handle (handlerInput) {
        return validateAppId(handlerInput.requestEnvelope.session)
            .then(() => {
                //  Make sure user says a restaurant
                const request = handlerInput.requestEnvelope.request;
                const session = handlerInput.requestEnvelope.session;

                const restaurant = request.intent.slots.restaurant.value;
                if (!restaurant) {
                    logger.logJsonMessage({
                        userId: session.user.userId,
                        query: 'Requesting restaurant'
                    });
                    return handlerInput.responseBuilder
                        .addDelegateDirective(request.intent)
                        .withShouldEndSession(false)
                        .getResponse();
                }

                //  Good to go, get user's location
                const system = handlerInput.requestEnvelope.context.System;
                const awsClient = new AWSClient(
                    system.apiAccessToken,
                    system.device.deviceId,
                    system.apiEndpoint
                );
                return awsClient.getDeviceAddress()
                    .then((json) => {
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
                                userId: session.user.userId,
                                query: restaurant,
                                location: 'Requesting permission'
                            });
                            return handlerInput.responseBuilder
                                .speak(`I need to know your location in order to find relevant results. You can give
                                    me permission in the Alexa App.`)
                                .withAskForPermissionsConsentCard(['read::alexa:device:all:address'])
                                .getResponse();
                        }
            
                        const userLocation = `${json.addressLine1}, ${json.city}, `
                            + `${json.stateOrRegion || json.postalCode}`;
                        logger.logJsonMessage({
                            userId: session.user.userId,
                            query: restaurant,
                            userLocation
                        });
                        return userLocation;
                    })
                    .then(userLocation => YelpClient.yelpSearch(restaurant, userLocation))
                    .then((data) => {
                        //  Check for no results
                        if (data.businesses.length === 0) {
                            return handlerInput.responseBuilder
                                .speak(`Sorry, I couldn't find any results for ${restaurant}.`)
                                .getResponse();
                        }
                        const topResult = data.businesses[0];
                        const topResultSpeech = `Your top result is 
                            ${replaceAmpersandBcAlexaIsALittleShit(topResult.name)}, 
                            ${metersToMiles(topResult.distance)} miles away, ${topResult.rating} stars with 
                            ${topResult.review_count} reviews.`;
                        return handlerInput.responseBuilder
                            .speak(`${topResultSpeech} Check out the Alexa App to see the rest of your results.`)
                            .withStandardCard(
                                'Yelp Results',
                                data.businesses
                                    .slice(0, 5)
                                    .map((business, i) => buildBusinessCardText(business, i + 1))
                                    .join('\n'),
                                topResult.image_url,
                                topResult.image_url
                            )
                            .getResponse();
                    })
                    .catch((e) => {
                        throw {
                            response: `I had a problem searching for ${restaurant}`,
                            code: '500',
                            message: `Error searching for ${restaurant}: ${e}`
                        };
                    });
            })
            .catch((id) => {
                throw {
                    response: 'I was unable to validate your application.',
                    code: '401',
                    message: `Invalid application ID: ${id}`
                };
            });
    }
};

const helpHandler = {
    canHandle (handlerInput) {
        return isIntentRequest(handlerInput, handlerTypes.help);
    },
    handle (handlerInput) {
        return handlerInput.responseBuilder
            .speak('You can say something like: look up Burger King.')
            .withShouldEndSession(false)
            .getResponse();
    }
};

const cancelHandler = {
    canHandle (handlerInput) {
        return isIntentRequest(handlerInput, handlerTypes.cancel);
    },
    handle (handlerInput) {
        return handlerInput.responseBuilder
            .speak('Enjoy your food!')
            .getResponse();
    }
};

const stopHandler = {
    canHandle (handlerInput) {
        return isIntentRequest(handlerInput, handlerTypes.stop);
    },
    handle (handlerInput) {
        return handlerInput.responseBuilder
            .speak('Enjoy your food!')
            .getResponse();
    }
};

const errorHandler = {
    canHandle () {
        return true;
    },
    handle (handlerInput, e) {
        let responseMsg = '';
        if (typeof e === 'string') {
            logger.logError(e);
            responseMsg = `Sorry, something went wrong. ${e}`;
        } else {
            logger.logError(`${e.code}: ${e.message || e.description}`);
            responseMsg = `Sorry, something went wrong. ${e.response || 'Please wait a little and try again.'}`;
        }
        return handlerInput.responseBuilder
            .speak(responseMsg)
            .reprompt(responseMsg)
            .getResponse();
    }
};

const skillBuilder = Alexa.SkillBuilders.custom();
exports.handler = skillBuilder
    .addRequestHandlers(
        launchRequestHandler,
        searchHandler,
        helpHandler,
        cancelHandler,
        stopHandler
    )
    .addErrorHandlers(errorHandler)
    .lambda();
