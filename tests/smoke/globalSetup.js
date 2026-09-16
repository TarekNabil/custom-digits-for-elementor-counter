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
    CONTAINER_SMOKE,
    PAGE_FILE,
    ensureEnvironment,
    log,
    wp,
    writeState,
} = require("./lib/environment");

module.exports = async function globalSetup() {
    const container = ensureEnvironment();

    const elementorVersion = wp(container, ["plugin", "get", "elementor", "--field=version"]).trim();
    const activePlugins = wp(container, ["plugin", "list", "--status=active", "--field=name"])
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean);

    // Recorded because a previously green run can fail purely from an Elementor
    // release, and that is the first thing to check when it does.
    log(`Elementor ${elementorVersion}; active plugins: ${activePlugins.join(", ")}`);

    const activeTheme = wp(container, ["theme", "list", "--status=active", "--field=name"]).trim();

    if (activeTheme !== "hello-elementor") {
        log(`activating hello-elementor (was ${activeTheme || "none"})`);
        wp(container, ["theme", "activate", "hello-elementor"]);
    }

    // Only errors this run produced should be reported.
    wp(container, ["eval-file", `${CONTAINER_SMOKE}/truncate-log.php`]);

    const created = wp(container, ["eval-file", `${CONTAINER_SMOKE}/create-page.php`]);
    const postId = (created.match(/^POSTID (\d+)$/m) || [])[1];
    const permalink = (created.match(/^PERMALINK (\S+)$/m) || [])[1];

    if (!postId || !permalink) {
        throw new Error(`could not create the smoke page:\n${created}`);
    }

    const response = await fetch(permalink);
    const html = await response.text();

    fs.mkdirSync(path.dirname(PAGE_FILE), { recursive: true });
    fs.writeFileSync(PAGE_FILE, html);

    writeState({
        container,
        postId: Number(postId),
        permalink,
        httpStatus: response.status,
        elementorVersion,
        activePlugins,
        baseUrl: BASE_URL,
    });

    log(`rendered ${permalink} -> HTTP ${response.status}, ${html.length} bytes`);
};
