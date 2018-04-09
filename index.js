const Alexa = require('alexa-sdk');

exports.handler = async (event, context) => {
    const alexa = Alexa.handler(event, context);
    alexa.appId = 'amzn1.ask.skill.2282e711-13c1-4712-bd89-e79554d6e908';
    alexa.registerHandlers(handlers);
    alexa.execute();
};

const handlers = {
    'LaunchRequest': function () {
        this.emit('SearchRestaurant');
    },
    'SearchRestaurant': function () {
        this.response.speak('Nah mate fight me');
        this.emit(':responseReady');
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
