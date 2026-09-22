/**
 * Removes the page created for the run; see the shared environment module.
 */

"use strict";

const { teardown } = require("./lib/environment");

module.exports = async function globalTeardown() {
    teardown();
};
