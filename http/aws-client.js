const httpRequest = require('./http-client');

function buildURL (url, params) {
    Object.keys(params).forEach((key) => {
        url = url.replace(new RegExp(`{${key}}`, 'g'), params[key]);
    });
    return url;
}

const endpoints = {
    deviceAddress: '/v1/devices/{deviceId}/settings/address'
};

module.exports = class AWSClient {
    constructor (apiAccessToken, deviceId, apiEndpoint) {
        this.apiAccessToken = apiAccessToken;
        this.deviceId = deviceId;
        this.apiEndpoint = apiEndpoint;
    }

    awsRequest (url) {
        return httpRequest({ url }, this.apiAccessToken);
    }

    getDeviceAddress () {
        return this.awsRequest(buildURL(
            this.apiEndpoint + endpoints.deviceAddress,
            { deviceId: this.deviceId }
        ))
            .then(response => response.json());
    }
};
