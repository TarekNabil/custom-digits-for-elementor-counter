/**
 * Brings up WordPress + Elementor and publishes the fixture page once, before
 * any e2e test runs.
 *
 * Setup work lives here rather than in the tests so the tests stay pure
 * assertions against a real, already-running browser session.
 */

"use strict";

const { CONTAINER_E2E, ensureEnvironment, log, wp, writeState } = require("./lib/environment");

module.exports = async function globalSetup() {
    const container = ensureEnvironment();

    const activeTheme = wp(container, ["theme", "list", "--status=active", "--field=name"]).trim();

    if (activeTheme !== "hello-elementor") {
        log(`activating hello-elementor (was ${activeTheme || "none"})`);
        wp(container, ["theme", "activate", "hello-elementor"]);
    }

    const created = wp(container, ["eval-file", `${CONTAINER_E2E}/create-page.php`]);
    const postId = (created.match(/^POSTID (\d+)$/m) || [])[1];
    const permalink = (created.match(/^PERMALINK (\S+)$/m) || [])[1];

    if (!postId || !permalink) {
        throw new Error(`could not create the e2e page:\n${created}`);
    }

    writeState({ container, postId: Number(postId), permalink });

    log(`published ${permalink}`);
};
