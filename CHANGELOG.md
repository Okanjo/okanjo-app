# Changelog

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
