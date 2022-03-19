# Changelog

## v3.1.0
Node v16 Upgrade!

Notable Changes:
- Using callback functions in service connectors is deprecated. Return a Promise or AsyncFunction instead.
- Boom and Raven are now peer dependencies, so you should add them yourself

- OkanjoApp.js
    - Removed Async dependency
    - Added config option `ravenOptions` to pass directly into the raven client, which may override defaults
    - connectToServices now uses Promise.all instead of the Async parallel
    - Various refactoring
- package.json:
    - Bumped to 3.0.0
    - Upgraded all dependencies to latest
    - Moved boom and raven to peer dependencies
    - Removed async lib
    - Moved eslint config inside

## v2.0.0
 * Updated for async/await and Node v8
 * Updated dependencies to latest
 * Removed OkanjoBoom and replaced with with latest Boom with .ok and .created hacks
 * `connectToServices` returns a promise so it can be awaited, `callback` is optional
 * `connectToServices` now throws if a service function errors, also emits `error` event
 * Service connectors can be async functions (handled by Async.js)
 * Removed `ifOk` helper, since it's irrelevant in Hapi 17
 * `report(...)` is now an async function which returns after the Sentry call completes. Will not throw an error.
 * Renamed `app.inspect` to `app.dump` to avoid Node 10 deprecation warnings. Custom symbol isn't worth the hassle.

## v1.0.2
 * Fixed triggering custom inspection on app instances (e.g. util.inspect firing app.inspect by mistake)
 
## v1.0.1
 * Corrected module name
 * Swapped out jshint for eslint for consistency with the other apps
 * Updated README for minor corrections

## v1.0.0
 * Initial public release, after 26 internal releases!
