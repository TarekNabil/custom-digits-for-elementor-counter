/**
 * E2E test: does the frontend script actually run in a real browser, and does
 * it keep the digits converted for the whole count-up animation?
 *
 * The smoke suite fetches the rendered HTML with plain `fetch()`, so it can
 * only prove the script is enqueued, never that it executes. This suite loads
 * the real page in a real browser and watches every DOM mutation Elementor's
 * own counter animation produces, to prove a Latin digit never flashes through
 * mid-animation — not just that the resting value ends up right.
 *
 * The two widgets are asserted by one parameterised test: what makes them
 * different is data (the expected values and the allowed character set), which
 * tests/lib/fixture.js holds for this suite and the smoke suite alike.
 */

"use strict";

const { test, expect } = require("@playwright/test");

const { readState } = require("./lib/environment");
const { WIDGETS, digitsOnly, selectorFor } = require("../lib/fixture");

const SELECTORS = Object.fromEntries(WIDGETS.map((widget) => [widget.key, selectorFor(widget)]));

/**
 * Installs a per-frame sampler before any page script runs, so it captures the
 * server-rendered first paint as well as every later change.
 *
 * Deliberately NOT a MutationObserver. Elementor writes a Latin value and this
 * plugin's own observer converts it; observer callbacks run in creation order as
 * microtasks, so a second observer here would record the Latin value that exists
 * between the two — a state the browser never paints. requestAnimationFrame runs
 * after the microtask queue drains, so every sample is a value about to be
 * painted, which is what "no Latin digit is ever visible" actually means.
 */
async function installRecorder(page) {
    await page.addInitScript((selectors) => {
        const keys = Object.keys(selectors);

        window.__cdc = { samples: {}, changedAt: {} };

        for (const key of keys) {
            window.__cdc.samples[key] = [];
            window.__cdc.changedAt[key] = 0;
        }

        function sample() {
            const elements = keys.map((key) => document.querySelector(selectors[key]));

            // All or nothing: a half-rendered page would otherwise start one
            // counter's sample list at a value the other never saw.
            if (elements.every(Boolean)) {
                keys.forEach((key, index) => {
                    const value = elements[index].textContent;
                    const samples = window.__cdc.samples[key];

                    // Only changes are interesting: a sample per frame for a
                    // two-second animation would be a hundred identical strings,
                    // and `length > 1` should mean "the value moved".
                    if (samples.length === 0 || samples[samples.length - 1] !== value) {
                        samples.push(value);
                        window.__cdc.changedAt[key] = Date.now();
                    }
                });
            }

            requestAnimationFrame(sample);
        }

        requestAnimationFrame(sample);
    }, SELECTORS);
}

/**
 * Navigates to the fixture page and returns the recorded samples, keyed by
 * widget, once every count-up has gone quiet.
 *
 * Elementor only starts the count-up once the widget is visible, so this
 * scrolls the last widget (the lowest of the stack, all in one column) into
 * view — otherwise a taller theme header could leave the counters below the
 * fold and the animation would never trigger.
 */
async function loadAndSettle(page, permalink) {
    await installRecorder(page);
    await page.goto(permalink);

    // Assert every counter exists before waiting for them to settle. The sampler
    // records nothing until it finds them all, so without this a missing element
    // surfaces as an opaque 15s settle timeout rather than "widget A is not
    // flagged" — which is exactly what a broken digit set looks like.
    for (const selector of Object.values(SELECTORS)) {
        await expect(page.locator(selector)).toHaveCount(1);
    }

    await page.locator(Object.values(SELECTORS).pop()).scrollIntoViewIfNeeded();

    await page.waitForFunction(
        (keys) => {
            const now = Date.now();

            return keys.every(
                (key) => window.__cdc.samples[key].length > 0 && now - window.__cdc.changedAt[key] > 500
            );
        },
        Object.keys(SELECTORS),
        { timeout: 15000 }
    );

    return page.evaluate(() => window.__cdc.samples);
}

test.describe("counter digit conversion", () => {
    let permalink;

    test.beforeAll(() => {
        ({ permalink } = readState());
    });

    for (const widget of WIDGETS) {
        test(`${widget.label}: renders its own digits on first paint and never flashes another set during the count-up`, async ({
            page,
        }) => {
            const samples = (await loadAndSettle(page, permalink))[widget.key];

            expect(samples[0]).toBe(widget.first);

            // More than one sample proves the animation actually ran and was
            // observed, not just that the resting value happens to be right.
            expect(samples.length).toBeGreaterThan(1);

            for (const value of samples) {
                expect(value).toMatch(widget.allowed);
            }

            expect(digitsOnly(samples[samples.length - 1])).toBe(widget.last);
        });
    }

    test("the frontend script raises no console errors", async ({ page }) => {
        const errors = [];
        page.on("console", (message) => {
            if (message.type() === "error") {
                errors.push(message.text());
            }
        });

        await loadAndSettle(page, permalink);

        expect(errors.filter((message) => message.includes("custom-digits-counter"))).toEqual([]);
    });
});
