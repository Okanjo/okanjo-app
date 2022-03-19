"use strict";

const Util = require('util');
const Raven = require('raven');
const Cluster = require('cluster');
const EventEmitter = require('events').EventEmitter;

/**
 * Common application helpers and configurations
 * @extends EventEmitter
 * @constructor
 */
class OkanjoApp extends EventEmitter {

    //region Setup & Configuration

    /**
     * Constructor
     * @param config – Application configuration
     */
    constructor(config) {
        super();

        // When the app scheduled to quit, this will be true
        this.gracefulShutdown = false;

        this.currentEnvironment = "default";
        this.config = config;

        // Copy static shortcuts
        this.response = OkanjoApp.response;
        this.copy = OkanjoApp.copy;
        this.flattenData = OkanjoApp.flattenData;

        // If we have an environment set in the process env vars, apply environment configuration overrides
        if (process.env.env && process.env.env !== "default") {
            this._applyEnvConfig(process.env.env, this.config);
        }

        // Set Sentry reporting context information
        this._reportToSentry = false;
        this.reportingContext = {
            environment: this.currentEnvironment,
            worker_type: process.env.worker_type || 'master'
        };

        // Create the reporter
        const ravenOptions = this.config.ravenOptions || {};
        this.ravenClient = new Raven.Client(this.config.ravenReportUri, {
            // release: ...
            tags: {
                worker_type: process.env.worker_type || 'master',
            },
            // extra: { key: ... }
            environment: this.currentEnvironment,
            ...ravenOptions
        });
        this._captureException = Util.promisify(this.ravenClient.captureException.bind(this.ravenClient));

        // Start rockin' reports
        this.updateReportingStatus(this.config.reportToSentry || false);

        //
        // Connection initialization
        //

        // Status var that determines whether the app is in the process of connecting to requisite services
        this._connecting = false;

        // Status var that determines whether the app has connected to all requisite services
        this.ready = false;

        // Bucket for prerequisite service connections that block app.ready
        this._serviceConnectors = [];
    }

    /**
     * Applies environment overrides to the app configuration
     * @param env
     * @param config
     */
    _applyEnvConfig(env, config) {
        if (config[env]) {
            if (Cluster.isMaster) {
                this.log('Using environment configuration:', env); // use STDERR so reports and stuff don't get noisy
            }
            this.copy(config, config[env]);
            this.currentEnvironment = env;
        } else {
            throw new Error('Oops! Unknown environment given (not in config): '+env);
        }
    }

    /**
     * Connect to all of the dependant services (e.g. mongo, rabbit, redis, etc)
     * @param [callback] - Will always fire, even if already connected
     * @returns Promise
     */
    connectToServices(callback) {
        return new Promise((resolve, reject) => {
            // Check the dependant service states
            if (this.ready) {
                // App is ready, just callback cuz we're good
                if (callback) return callback();
                return resolve();
            } else {

                // Register the callback when the app finishes initializing
                const ready = () => {
                    if (callback) return callback();
                    return resolve();
                };
                this.once('ready', ready);

                // Check the connection progress
                if (!this._connecting) {
                    this._connecting = true;

                    Promise
                        .all(this._serviceConnectors.map(fn => {
                            // 99% of the time, AsyncFunctions and Promises are interchangeable
                            // but not in Promise.all !
                            if (fn[Symbol.toStringTag] === "AsyncFunction") {
                                return new Promise((resolve, reject) => {
                                    fn().then(resolve, reject);
                                });
                            } else if (fn[Symbol.toStringTag] === "Promise") {
                                return fn;
                            } else {
                                this.log('[OkanjoApp] Callbacks deprecated: Service connectors should return async functions or promises');
                                return Util.promisify(fn);
                            }
                        }))
                        .then(() => {
                            this.ready = true;
                            this._connecting = false;
                            this.emit('ready');
                        }, (err) => {
                            this._connecting = false;
                            this.removeListener('ready', ready);
                            this.emit('error', err);
                            if (callback) return callback(err);
                            return reject(err);
                        })
                    ;
                }
            }
        });
    }

    /**
     * Registers a service connector that will be called when connectToServices is called
     * @param connector – Fired when app should connect to services
     */
    registerServiceConnector(connector) {
        this._serviceConnectors.push(connector);
        // TODO - consider firing the connector is the application has already started (e.g. late connector)
    }

    //endregion

    //region Utility Functions

    /**
     * Simple, deep, key-value copier
     * @param {*} destination – Target object or empty to make brand new copy
     * @param {*} source – Object to make a duplicate of
     * @return {*} – The resulting object, which might be the same as dest unless source was a value not a reference
     * @author Kevin Fitzgerald
     */
    static copy(destination, source) {
        if (source !== null && typeof source === "object") {
            if (Array.isArray(source)) {
                destination = destination || [];
                source.forEach((val, index) => {
                    destination[index] = OkanjoApp.copy(destination[index], val);
                });
            } else {
                destination = destination || {};
                Object.keys(source).forEach((key) => {
                    destination[key] = OkanjoApp.copy(destination[key], source[key]);
                });
            }
        } else {
            destination = source;
        }

        return destination;
    }

    /**
     * Flattens a multi-dimensional object into a single list of key-value pairs (e.g. meta.boobs => meta_boobs)
     * @param input
     * @param options
     * @return {*}
     */
    static flattenData(input, options = {}) {
        const output = {};

        if (input !== undefined && input !== null) {
            Object.keys(input).forEach((key) => {
                // Convert object ids to hex strings
                if (input[key] instanceof Date) {
                    if (options.dateToIso) {
                        output[key] = input[key].toISOString(); // convert to iso
                    } else {
                        output[key] = input[key]; // as-is
                    }
                } else if (typeof input[key] === "object" && input[key] && input[key].constructor && input[key].constructor.name === "ObjectID") { // Object.create(null) is truthy, but .constructor is undefined
                    output[key] = input[key].toString();
                } else if (typeof input[key] === 'object') {
                    // Make child objects flat too (always returns object so Object.keys is safe)
                    const childObject = OkanjoApp.flattenData(input[key], options);
                    Object.keys(childObject).forEach((childKey) => {
                        output[key + '_' + childKey] = childObject[childKey];
                    });
                } else {
                    // Copy value references
                    output[key] = input[key];
                }
            });
        }

        return output;
    }

    //endregion

    //region Reporting Functions

    /**
     * Reports whatever to Sentry
     * @example `app.report("message", err, { data })`
     */
    async report() {

        const agg = { err: undefined, meta: { }, reported: false };

        // Capture where we reported from
        const reportStack = {};
        Error.captureStackTrace(reportStack, this.report);
        reportStack.name = "Reported By:";

        // Show to the console unless ENV var is set to supress
        if (!process.env.SILENCE_REPORTS) {
            console.error('');
            console.error('/------------------------------[ REPORT ]--------------------------------\\');

            // Pick the error out and add the rest to the meta array
            for (let i = 0; i < arguments.length; i++) {

                if (typeof arguments[i] === "object" && arguments[i] instanceof Error) {
                    console.error(arguments[i].stack);
                    agg.err = arguments[i];
                } else {
                    console.error(Util.inspect(arguments[i], {colors: true, depth: 5}));
                    agg.meta['arg' + i] = arguments[i];
                }
            }

            console.error('');
            console.error(reportStack.stack);

            console.error('\\------------------------------------------------------------------------/');
            console.error('');
        }

        // Report as exception so we always know who was responsible for this
        if (this._reportToSentry) {

            // Always get a stack trace
            if (agg.err === undefined) {
                let derivedName = Object.values(agg.meta).find(v => typeof v === "string" && v.length > 0) || "???";
                agg.err = new Error('Report: ' + derivedName);
            }

            // Merge global context
            Object.keys(this.reportingContext).forEach((i) => {
                agg.meta[i] = this.reportingContext[i];
            });

            // Stick in a report stack just to make it easier to figure out how we got to this report
            agg.meta.report_stack = reportStack.stack;

            const data = {
                // user
                // req
                // tags
                // fingerprint
                // level
                extra: agg.meta
            };

            try {
                const eventId = await this._captureException(agg.err, data);
                console.error(' >> Reported as ', eventId);
                agg.eventId = eventId;
                agg.reported = true;
            } catch(err) /* istanbul ignore next: out of scope */ {
                console.error(' >> Failed to report to sentry!', err instanceof Error ? err.stack : err);
            }
        }

        return agg;
    }

    //noinspection JSMethodCanBeStatic
    /**
     * Inspects whatever you give it. Formerly app.inspect(...)
     */
    dump(...args) {
        for (let i = 0; i < args.length; i++) {
            console.error(typeof args[i] === "object" && args[i] instanceof Error ? args[i].stack : Util.inspect(args[i], { colors: true, depth: 5, customInspect: false }) );
        }
    }

    //noinspection JSMethodCanBeStatic
    /**
     * Wrapper around console.error for application logging, so they can be silenced for tests and stuff
     * @param args
     */
    log(...args) {
        if (!process.env.SILENCE_REPORTS) {
            console.error.apply(console, args);
        }
    }

    /**
     * Will change Sentry reporting status. Will bind process unhandled exceptions if enabled.
     * @param enabled
     */
    updateReportingStatus(enabled) {
        this._reportToSentry = enabled || false;

        if (this._reportToSentry) {
            this.log(` > ${Cluster.isWorker ? (process.env.worker_type || 'worker') : 'main' }: Will report uncaught exceptions, starting now.`);
            /* istanbul ignore next: actually triggering an uncaught exception is impossible with mocha */
            process.once('uncaughtException', (err) => this._reportUncaughtException(err));
        }
    }

    /**
     * Report uncaught exceptions and die when one happens
     * @param err
     */
    async _reportUncaughtException(err) {
        // Tell us everything we are doing wrong
        let exitAfterReport = arguments.length <= 1;

        console.error('');
        console.error('/------------------------------[ FATAL EXCEPTION ]--------------------------------\\');
        console.error(err.stack);
        console.error('\\---------------------------------------------------------------------------------/');
        console.error('');

        const eventId = await this._captureException(err, { extra: this.reportingContext });
        console.error(' >> Reported uncaught exception as ', eventId);
        if (exitAfterReport) process.exit(1);
    }

    /**
     * Merges the given context information into the reporting context data
     * @param context
     */
    setReportingContext(context) {
        Object.keys(context).forEach(function(i) {
            this.reportingContext[i] = context[i];
        }, this);
    }

    //endregion
}

/**
 * Response generator
 * @type {Boom}
 * @see https://github.com/hapijs/boom
 */
OkanjoApp.response = require('@hapi/boom');

/**
 * Returns a consistent response payload, like Booms but not
 * @param data
 * @param statusCode
 * @param h – Response toolkit
 * @returns {*}
 */
OkanjoApp.response.custom = (data, statusCode, h) => {
    const output = { statusCode, error: null, data };
    if (h) return h.response(output).code(statusCode);
    return output;
};

/**
 * Creates a 200-ok response object
 * @param {*} data - Response data
 * @param {*} h – Response toolkit
 * @return {{statusCode: number, error: null, data: *}}
 */
OkanjoApp.response.ok = (data, h) => {
    return OkanjoApp.response.custom(data, 200, h);
};

/**
 * Creates a 201-created response object
 * @param {*} data - Response data
 * @param {*} h – Response toolkit
 * @return {{statusCode: number, error: null, data: *}}
 */
OkanjoApp.response.created = (data, h) => {
    return OkanjoApp.response.custom(data, 201, h);
};

/**
 * Helper to format an object or an array of objects using a closure function
 * @param {Object|Object[]} obj - Object to format
 * @param {function(obj:Object)} closure - Called on each object, expects a return value of the formatted object
 * @return {*}
 */
OkanjoApp.response.formatForResponse = (obj, closure) => {
    let out;
    if (Array.isArray(obj)) {
        // ARRAY (recursive)
        out = [];
        for(let i = 0; i < obj.length; i++) {
            out.push(OkanjoApp.response.formatForResponse(obj[i], closure));
        }
    } else {
        // SINGLE
        if (!obj) {
            out = null;
        } else {
            // Object-specific inclusion function
            out = closure(obj);

            // Automatically add auditing fields
            if (out && obj.created !== undefined) { out.created = obj.created; }
            if (out && obj.updated !== undefined) { out.updated = obj.updated; }
        }
    }
    return out;
};

module.exports = OkanjoApp;