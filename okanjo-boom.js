"use strict";

/**
 * @class Boom
 * @see https://github.com/hapijs/boom
 */
const Boom = require('boom');

/**
 * @typedef {Object} Response - Okanjo response object
 * @property {number} statusCode - HTTP status code (useful for jsonp)
 * @property {string} error - Error information, if present
 * @property {string} [message] - May appear when an error is present
 * @property {*} data - Response payload
 */

/**
 * Helper that creates a response object
 * @param code
 * @param data
 * @return {Response}
 * @private
 */
function makeResponse(code, data) {
    return { statusCode: code, error: null, data: data };
}

/**
 * Creates a 200-ok response object
 * @param {Object|Array} data - Response data
 * @return {Response}
 */
Boom.ok = function(data) {
    return makeResponse(200, data);
};


/**
 * Creates a 201-created response object
 * @param {Object|Array} data - Response data
 * @return {Response}
 */
Boom.created = function(data) {
    return makeResponse(201, data);
};


/**
 * Helper to format an object or an array of objects using a closure function
 * @param {Object|Object[]} obj - Object to format
 * @param {function(obj:Object)} closure - Called on each object, expects a return value of the formatted object
 * @return {*}
 */
Boom.formatForResponse = function(obj, closure) {
    let out;
    if (Array.isArray(obj)) {
        // ARRAY (recursive)
        out = [];
        for(let i = 0; i < obj.length; i++) {
            out.push(Boom.formatForResponse(obj[i], closure));
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

module.exports = Boom;

