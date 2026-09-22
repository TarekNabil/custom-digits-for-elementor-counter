/**
 * The shared wp-env plumbing, bound to this suite's output directory.
 *
 * Shared by globalSetup, globalTeardown and the tests themselves.
 */

"use strict";

module.exports = require("../../lib/environment").forSuite("smoke");
