/**
 * Brings up WordPress + Elementor and publishes the fixture page once, before
 * any e2e test runs.
 *
 * Setup work lives here rather than in the tests so the tests stay pure
 * assertions against a real, already-running browser session.
 */

"use strict";

const { createPage, ensureEnvironment, ensureTheme, log, writeState } = require("./lib/environment");

module.exports = async function globalSetup() {
    const container = ensureEnvironment();

    ensureTheme(container);

    const { postId, permalink } = createPage(container, "Custom Digits e2e test");

    writeState({ container, postId, permalink });

    log(`published ${permalink}`);
};
