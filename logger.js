module.exports = class Logger {
  constructor (name) {
    this.name = name;
  }

  logJsonMessage (json) {
    console.log(`[${this.name}] - ${JSON.stringify(json, null, 2)}`);
  }

  logMessage (message) {
    console.log(`[${this.name}] - ${message}`);
  }
  
  logError (error) {
    console.error(`[${this.name}] - ${error}`);
  }
};
