/**
 * Brings up WordPress + Elementor and renders the fixture page once, before any
 * smoke test runs.
 *
 * Setup work lives here rather than in the tests so the tests stay pure
 * assertions: they read the captured HTML and query the container, and never
 * mutate the site.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const {
    BASE_URL,
    CONTAINER_SUITE,
    PAGE_FILE,
    createPage,
    ensureEnvironment,
    ensureTheme,
    log,
    wp,
    writeState,
} = require("./lib/environment");

module.exports = async function globalSetup() {
    const container = ensureEnvironment();

    const wordpressVersion = wp(container, ["core", "version"]).trim();
    const elementorVersion = wp(container, ["plugin", "get", "elementor", "--field=version"]).trim();
    const activePlugins = wp(container, ["plugin", "list", "--status=active", "--field=name"])
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean);

    // Recorded because a previously green run can fail purely from a WordPress or
    // Elementor release, and that is the first thing to check when it does. The
    // pre-release workflow also asserts on these, so that a leg meant to test
    // trunk or a beta build cannot pass while quietly running stable.
    log(`WordPress ${wordpressVersion}; Elementor ${elementorVersion}; active plugins: ${activePlugins.join(", ")}`);

    ensureTheme(container);

    // Only errors this run produced should be reported.
    wp(container, ["eval-file", `${CONTAINER_SUITE}/truncate-log.php`]);

    const { postId, permalink } = createPage(container, "Custom Digits smoke test");

    const response = await fetch(permalink);
    const html = await response.text();

    fs.mkdirSync(path.dirname(PAGE_FILE), { recursive: true });
    fs.writeFileSync(PAGE_FILE, html);

    writeState({
        container,
        postId,
        permalink,
        httpStatus: response.status,
        wordpressVersion,
        elementorVersion,
        activePlugins,
        baseUrl: BASE_URL,
    });

    log(`rendered ${permalink} -> HTTP ${response.status}, ${html.length} bytes`);
};
