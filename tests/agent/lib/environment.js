/**
 * The shared wp-env plumbing, bound to this suite's output directory.
 *
 * Used by run.js; the tests read the state it writes from output/state.json.
 */

"use strict";

module.exports = require("../../lib/environment").forSuite("agent");
