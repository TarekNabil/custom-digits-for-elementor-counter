/**
 * Removes the page created for the run.
 *
 * The environment itself is left running: the next run reuses it, which saves
 * minutes and avoids wp-env's network calls.
 */

"use strict";

const fs = require("fs");

const { readState, log, wp } = require("./lib/environment");

module.exports = async function globalTeardown() {
    let state;

    try {
        state = readState();
    } catch {
        return;
    }

    try {
        wp(state.container, ["post", "delete", String(state.postId), "--force"]);
        log(`deleted page ${state.postId}`);
    } catch (error) {
        // Never fail a passing run over cleanup; the page is harmless and the
        // next run creates its own.
        log(`could not delete page ${state.postId}: ${error.message}`);
    }
};
