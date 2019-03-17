# Okanjo Application Framework

[![Build Status](https://travis-ci.org/Okanjo/okanjo-app.svg?branch=master)](https://travis-ci.org/Okanjo/okanjo-app) [![Coverage Status](https://coveralls.io/repos/github/Okanjo/okanjo-app/badge.svg?branch=master)](https://coveralls.io/github/Okanjo/okanjo-app?branch=master)

This module framework helps make creating scalable applications quick and simple, focusing on configuration and flexibility over boilerplate.

The core application module handles:
* Multi-environment, extendable application configuration
* Error reporting (optionally, via [Sentry.io](https://sentry.io))
* Connection and start up initialization handling
* Utility functions 

The principle here is that an application is built upon okanjo-app, leveraging other okanjo modules to interface with 
various services. 

## Installing

Add to your project like so: 

```sh
npm install okanjo-app
```

## Example usage

A very simple implementation could look like this:

```js
const OkanjoApp = require('okanjo-app');
const config = {
    yourThing: {
        yourKey: 'yourValue'
    },
    reportToSentry: false,
    //ravenReportUri: 'http://your-app@app.getsentry.com/number'
};

const app = new OkanjoApp(config);

// Additional initialization, plugin registering, etc

// Go!
await app.connectToServices();

// Or with callbacks:
app.connectToServices(() => {
    // Everything connected, ready to do your thing!
});

```

We generally recommend creating a config.js file, that exports a configuration object.

```text
my_app/
+- node_modules/
+- routes/
+- config.js
+- index.js
+- package.json
```

config.js:
```js
const Path = require('path');
module.exports = {
    webServer: {
        port: 3000,
        routePath: Path.join(__dirname, 'routes')
    },
    
    reportToSentry: false,
    //ravenReportUri: 'https://your-reporting-uri',
    
    production: {
        webServer: {
            port: 80
        },
        reportToSentry: true
    }
};
```

index.js:
```js
const OkanjoApp = require('okanjo-app');
const app = new OkanjoApp(config);

app.connectToServices(() => {
    // Everything connected, ready to do your thing!
});
```

Then you can start the app like so:
* Default environment (e.g. locally): `node .`
* Production environment: `env=production node .`

## Properties

* `app.config` – The effective configuration of the application.
* `app.currentEnvironment` – The name of the current application environment. (e.g. `default`)
* `app.gracefulShutdown` – Flag your application may use to indicate the app should be shutting down.
* `app.ravenClient` – [Raven](https://docs.sentry.io/clients/node/) client instance
* `app.ready` – Boolean indicating whether `app.connectToServices` was called and completed.
* `app.reportingContext` – Object whose key-value pairs are copied to error reports.

## Methods

### Constructor

`const app = new OkanjoApp(config)`
* `config`: Object with key-values or nested environment configurations

### `await app.connectToServices([callback])`
Starts initialization for any registered services and fires the callback once all are completed.
* `callback(err)`: Function that is fired when application modules finish initializing.
  * `err` – if a service connector returns an error, it'll stop and get caught here
* Returns a `Promise`, so you can await it

### `app.updateReportingStatus(enabled)`
This method is internally called when constructing. You may use this method to enable reporting if initially disabled.

* `enabled`: Boolean flag to turn reporting on (`true`) or off (`false`)

### `app.setReportingContext(context)`
Attaches the given keys within `context` to the reporting context, which is attached to any future error reports. 
This is useful for setting global information on error reports, such as environment, application, current server, etc.
* `context`: Object with key-value pairs. 

### `await app.report(...)`
Used to report application errors or bad things to stderr and if configured, Sentry.

This method will take any number of parameters. 
The last `Error` object encountered will be selected as the error being reported.
If no `Error` object is provided, one will be generated using the first `string` argument provided.

For example:
```js
myService.connect((err) => {
    if (err) {
        app.report('Failed to connect to my service!', err, { additional: 'context'});
    }
    // ...
});
```

Other example usages:
* `await app.report(err)` - just report an error with no context
* `await app.report('what happened', err)` - report what happened with the original error
* `await app.report('what happened', { err, arg, context, whatever })` - report what happened and provide additional data, detailing what the state was at the time of the error

### `app.dump(...)`
Takes any number of arguments, and for each, prints each to stderr with colors and max depth of 5. Useful for quickly debugging or reporting information about a complex object.

Example usages:
* `app.dump(myObject)`
* `app.dump(myThing, myOtherThing, 42)`

> Note: This was formerly `app.inspect(...)`

### `app.log(...)`
A wrapper around console.log that writes to stderr and can be conditionally disabled by setting environment variable `SILENCE_REPORTS=1`.
Useful for making various logging tasks optional.

Example usages:
* `app.log('hey look at this thing, thing)`;

### `app.copy(destination, source)`
### `OkanjoApp.copy(destination, source)`
Deep copies key-values from `source` to `destination`. Traverses arrays and objects recursively.
* `source` – Source object to copy from
* `destination` – Destination object to copy into. If not truthy, it will be made into an object or array. 

For example:
```js
const source = {
    a: 1,
    b: {
        hi: 'there'
    },
    e: null
};

const destination = {
    c: true,
    b: { there: 'hi' },
    d: null
};

app.copy(destination, source);

/* destination now looks like:
{
    a: 1,
    b: { hi: 'there', there: 'hi' },
    c: true,
    d: null,
    e: null
}
 */

```

### `app.flattenData(input, options)`
### `OkanjoApp.flattenData(input, options)`
Useful for flattening a nested object into a single level object.
* `input` – The object to flatten
* `options` – Optional. Flags that can affect the output.
** `options.dateToIso` – If truthy, then date objects will be flattened into an ISO string.

MongoDB ObjectId's will be converted to hex strings.

For example:
```js
app.flattenData({ a: { b: 1, c: { d: [2,3,4] }}});

/* returns:
{
    a_b: 1,
    a_c_d_0: 2,
    a_c_d_1: 3,
    a_c_d_2: 4 
}
 */

```
 
### `app.response`
OkanjoApp extends [Hapi Boom](https://github.com/hapijs/boom). All boom methods are available as possible responses. 
Since Boom is great for error response building, OkanjoApp extends it to add consistent 'positive' responses.

For example:
```js
app.response.badRequest('You goofed');
/* Reply shows:
{
    "statusCode": 400,
    "error": "Bad Request",
    "message": "You goofed"
}
 */
```
 
### `app.response.ok(data)`
Creates a new 200/ok response with the given data payload.
* `data` – value to output as data in the response.

For example:
```js
app.response.ok({ hello: 'world' });
/* Reply shows:
{
    "statusCode": 200,
    "error": null,
    "data": { "hello": "world" }
}
 */
```

### `app.response.created(data)`
Creates a new 201/created response with the given data payload.
* `data` – value to output as data in the response.

For example:
```js
app.response.created({ hello: 'world' });
/* Reply shows:
{
    "statusCode": 201,
    "error": null,
    "data": { "hello": "world" }
}
 */
```

### `app.response.formatForResponse(obj, closure)`
Useful helper function for converting internal data objects into ones suitable for api output.
* `obj` – Object or array of objects to format
* `closure(obj)` – Function which is expected to format and return the a single object

Note: This method automatically attaches `obj.created` and `obj.updated` is present in `obj`.  

For example:
```js
function formatter(mixed) {
    return app.response.formatForResponse(mixed, (obj) => {
        return {
            id: "thing_" + obj._id,
            name: obj.name || "Untitled",
            // ...
        };
    });
}

formatter({
    _id: "1",
    name: "thing 1",
    secret: "you should not see me",
    created: new Date(),
    updated: null
})
/* 
{ id: 'thing_1',
  name: 'thing 1',
  created: 2017-11-07T18:26:09.022Z,
  updated: null }
*/


formatter({
    _id: "2",
    name: null,
    secret: "you should not see me"
})
/* 
{ id: 'thing_2', name: 'Untitled' }
*/
``` 

## Events

### `app.once('ready', callback)`
Fires `callback` when the app has finished connecting to all services and is ready.

### `app.once('error', callback)`
Fires `callback(err)` when a service connector fails on `connectToServices()`


## Extending and Contributing 

Our goal is quality-driven development. Please ensure that 100% of the code is covered with testing.

Before contributing pull requests, please ensure that changes are covered with unit tests, and that all are passing. 

### Testing

To run unit tests and code coverage:
```sh
npm run report
```

This will perform:
* Unit tests
* Code coverage report
* Code linting

Sometimes, that's overkill to quickly test a quick change. To run just the unit tests:
 
```sh
npm test
```

or if you have mocha installed globally, you may run `mocha test` instead.
