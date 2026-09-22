/**
 * The shared wp-env plumbing, bound to this suite's output directory.
 *
 * Shared by global-setup, global-teardown and playwright.config.js.
 */

"use strict";

module.exports = require("../../lib/environment").forSuite("e2e");
