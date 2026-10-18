/**
 * Runs the agent suite: boots WordPress, publishes the fixture page, signs in,
 * runs `e2e run` with any arguments passed through, then removes the page.
 *
 * The e2e runner has no global setup hook, so this wraps it the way
 * tests/e2e/global-setup.js and global-teardown.js wrap Playwright.
 *
 *   npm run test:agent
 *   npm run test:agent -- tests/agent/custom-digits.e2e.ts --headed
 */

"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const { CONTAINER_SUITE, createPage, ensureEnvironment, ensureTheme, log, teardown, wp, writeState } =
    require("./lib/environment");

const ROOT = path.resolve(__dirname, "..", "..");
const E2E = path.join(ROOT, "node_modules", ".bin", "e2e");

/** Reads the cookies sign-in.php prints, in the shape browser.setCookies() takes. */
function signIn(container, url) {
    const output = wp(container, ["eval-file", `${CONTAINER_SUITE}/sign-in.php`]);
    const cookies = [...output.matchAll(/^COOKIE (\S+) (\S+)$/gm)].map(([, name, value]) => ({ name, value, url }));

    if (cookies.length !== 2) {
        throw new Error(`could not sign in as admin:\n${output}`);
    }

    return cookies;
}

const container = ensureEnvironment();

ensureTheme(container);

const { postId, permalink } = createPage(container, "Custom Digits agent test");

writeState({ container, postId, permalink, cookies: signIn(container, new URL(permalink).origin) });

log(`published ${permalink}`);

// Ctrl+C reaches the runner too; staying alive until it exits lets the page be
// removed afterwards instead of left behind.
process.on("SIGINT", () => {});

let result;

try {
    result = spawnSync(E2E, ["run", ...process.argv.slice(2)], { cwd: ROOT, stdio: "inherit" });
} finally {
    teardown();
}

if (result.error) {
    throw result.error;
}

process.exitCode = result.status ?? 1;
