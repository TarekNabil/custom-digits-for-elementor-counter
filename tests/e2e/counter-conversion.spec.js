/**
 * E2E test: does the frontend script actually run in a real browser, and does
 * it keep the digits converted for the whole count-up animation?
 *
 * The smoke suite fetches the rendered HTML with plain `fetch()`, so it can
 * only prove the script is enqueued, never that it executes. This suite loads
 * the real page in a real browser and watches every DOM mutation Elementor's
 * own counter animation produces, to prove a Latin digit never flashes through
 * mid-animation — not just that the resting value ends up right.
 */

"use strict";

const { test, expect } = require("@playwright/test");

const { readState } = require("./lib/environment");

const WIDGET_A_SELECTOR = '.elementor-counter-number[data-custom-digits-counter="yes"]';
const WIDGET_B_SELECTOR = '.elementor-counter-number[data-custom-digits-counter="no"]';

// Elementor formats the counter with its `data-delimiter` setting, so a rendered
// value is "٢,٠٢٥" rather than "٢٠٢٥". The digit characters are what this suite
// is about, so the delimiter is permitted in the patterns and stripped before
// comparing against an expected number.
const ARABIC_INDIC_ONLY = /^[٠-٩,.\s]+$/;
const HAS_LATIN_DIGIT = /[0-9]/;
const LATIN_ONLY = /^[0-9,.\s]+$/;

/** Removes group separators so a sample can be compared to a plain number. */
function digitsOnly(value) {
    return value.replace(/[,.\s]/g, "");
}

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
    await page.addInitScript(
        ({ selectorA, selectorB }) => {
            window.__cdc = { a: [], b: [], aChangedAt: 0, bChangedAt: 0 };

            function record(key, element) {
                const value = element.textContent;
                const samples = window.__cdc[key];

                // Only changes are interesting: a sample per frame for a
                // two-second animation would be a hundred identical strings,
                // and `length > 1` should mean "the value moved".
                if (samples.length === 0 || samples[samples.length - 1] !== value) {
                    samples.push(value);
                    window.__cdc[key + "ChangedAt"] = Date.now();
                }
            }

            function sample() {
                const a = document.querySelector(selectorA);
                const b = document.querySelector(selectorB);

                if (a && b) {
                    record("a", a);
                    record("b", b);
                }

                requestAnimationFrame(sample);
            }

            requestAnimationFrame(sample);
        },
        { selectorA: WIDGET_A_SELECTOR, selectorB: WIDGET_B_SELECTOR }
    );
}

/** Waits until both counters have gone quiet, i.e. the count-up finished. */
async function waitForSettled(page) {
    await page.waitForFunction(
        () => {
            const now = Date.now();
            return (
                window.__cdc.a.length > 0 &&
                window.__cdc.b.length > 0 &&
                now - window.__cdc.aChangedAt > 500 &&
                now - window.__cdc.bChangedAt > 500
            );
        },
        { timeout: 15000 }
    );

    return page.evaluate(() => window.__cdc);
}

/**
 * Navigates to the fixture page and returns the recorded samples once the
 * count-up has finished.
 *
 * Elementor only starts the count-up once the widget is visible, so this
 * scrolls widget B (the lower of the two, stacked in the same column) into
 * view — otherwise a taller theme header could leave both counters below the
 * fold and the animation would never trigger.
 */
async function loadAndSettle(page, permalink) {
    await installRecorder(page);
    await page.goto(permalink);

    // Assert both counters exist before waiting for them to settle. The sampler
    // records nothing until it finds both, so without this a missing element
    // surfaces as an opaque 15s settle timeout rather than "widget A is not
    // flagged" — which is exactly what a broken digit set looks like.
    await expect(page.locator(WIDGET_A_SELECTOR)).toHaveCount(1);
    await expect(page.locator(WIDGET_B_SELECTOR)).toHaveCount(1);

    await page.locator(WIDGET_B_SELECTOR).scrollIntoViewIfNeeded();

    return waitForSettled(page);
}

test.describe("counter digit conversion", () => {
    let permalink;

    test.beforeAll(() => {
        ({ permalink } = readState());
    });

    test("widget A: shows custom digits on first paint, and never flashes Latin digits during the count-up", async ({
        page,
    }) => {
        const samples = await loadAndSettle(page, permalink);

        expect(samples.a[0]).toBe("٧٨٦");

        // More than one sample proves the animation actually ran and was
        // observed, not just that the resting value happens to be right.
        expect(samples.a.length).toBeGreaterThan(1);

        for (const value of samples.a) {
            expect(value).toMatch(ARABIC_INDIC_ONLY);
            expect(value).not.toMatch(HAS_LATIN_DIGIT);
        }

        expect(digitsOnly(samples.a[samples.a.length - 1])).toBe("٢٠٢٥");
    });

    test("widget B (control): keeps Latin digits throughout, unaffected by the conversion", async ({ page }) => {
        const samples = await loadAndSettle(page, permalink);

        expect(samples.b[0]).toBe("512");
        expect(samples.b.length).toBeGreaterThan(1);

        for (const value of samples.b) {
            expect(value).toMatch(LATIN_ONLY);
        }

        expect(digitsOnly(samples.b[samples.b.length - 1])).toBe("1999");
    });

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
