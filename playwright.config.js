/**
 * Playwright configuration for the e2e suite.
 *
 * Separate from the smoke suite: this one drives real browsers against the
 * live wp-env site to prove the frontend script actually executes, rather
 * than fetching static HTML.
 */

"use strict";

const { defineConfig, devices } = require("@playwright/test");

const { BASE_URL } = require("./tests/e2e/lib/environment");

module.exports = defineConfig({
    testDir: "./tests/e2e",
    testMatch: "**/*.spec.js",
    globalSetup: require.resolve("./tests/e2e/global-setup.js"),
    globalTeardown: require.resolve("./tests/e2e/global-teardown.js"),
    // Booting wp-env from cold pulls Docker images and WordPress; the count-up
    // animations themselves also take a few seconds each.
    timeout: 60000,
    fullyParallel: true,
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ],
});
