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
        //  Make sure user says a restaurant
        const restaurant = this.event.request.intent.slots.restaurant.value;
        if (!restaurant) {
            this.emit(':delegate', this.event.request.intent);
        } else {
            //  We're good to go
            this.response.speak(`Nah mate look up ${restaurant} yourself`);
            this.emit(':responseReady');
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
