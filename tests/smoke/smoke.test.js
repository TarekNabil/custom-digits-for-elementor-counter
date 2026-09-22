/**
 * Smoke test: does the plugin work inside real WordPress with real Elementor?
 *
 * The unit suites (composer test, npm test) exercise the pieces in isolation.
 * This one answers what they cannot — whether the pieces fit together — by
 * booting a real site, rendering a Counter widget and reading the HTML that a
 * visitor would receive.
 *
 * Not an end-to-end test: the page is fetched, not executed, so this proves the
 * scripts are enqueued, never that they run. That gap needs a browser, and
 * tests/e2e covers it against the same fixture.
 */

"use strict";

const fs = require("fs");

const { CONTAINER_SUITE, PAGE_FILE, PLUGIN_SLUG, readState, wp } = require("./lib/environment");
const { WIDGETS } = require("../lib/fixture");

const state = readState();
const html = fs.readFileSync(PAGE_FILE, "utf8");

/**
 * Pulls out Elementor's counter number elements, in document order.
 *
 * Asserting against the whole page would work, but a failure then prints the
 * entire document. Comparing the element's text directly reports
 * `Expected "٧٨٦" / Received "786"`, which names the actual problem.
 */
function counterElements(markup) {
    const pattern = /<span[^>]*\bclass="[^"]*\belementor-counter-number\b[^"]*"[^>]*>([^<]*)<\/span>/g;

    return [...markup.matchAll(pattern)]
        .filter((match) => !/elementor-counter-number-(prefix|suffix)/.test(match[0]))
        .map((match) => ({ tag: match[0], text: match[1] }));
}

const counters = counterElements(html);

describe("environment", () => {
    test("the page was served successfully", () => {
        expect(state.httpStatus).toBe(200);
    });

    test("the plugin is active", () => {
        expect(state.activePlugins).toContain(PLUGIN_SLUG);
    });

    test("Elementor is active", () => {
        expect(state.activePlugins).toContain("elementor");
    });
});

describe("boot", () => {
    // boot-assertions.php runs inside WordPress, where it can see loaded classes
    // and the hook registry, and prints one PASS/FAIL line per check.
    const results = wp(state.container, ["eval-file", `${CONTAINER_SUITE}/boot-assertions.php`])
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => [line.replace(/^(PASS|FAIL) /, ""), line.startsWith("PASS")]);

    test("the checks actually ran", () => {
        expect(results.length).toBeGreaterThan(0);
    });

    test.each(results)("%s", (_label, ok) => {
        expect(ok).toBe(true);
    });
});

// Elementor renders starting_number as the element's text and animates up to
// data-to-value in JavaScript. So server-side conversion is visible in the text,
// while data-to-value must stay Latin for the frontend script to parse.
// Assertions match ">value</span>" rather than the value anywhere, which would
// also match the attributes and pass for the wrong reason.
describe("rendered counters", () => {
    test("every fixture widget was rendered", () => {
        expect(counters).toHaveLength(WIDGETS.length);
    });

    // Fixture order is document order, so the widgets line up with the markup.
    describe.each(WIDGETS.map((widget, index) => [widget.label, widget, index]))(
        "%s",
        (_label, widget, index) => {
            const counter = () => counters[index];

            test("renders its first value", () => {
                expect(counter().text).toBe(widget.first);
            });

            test("carries the conversion flag", () => {
                expect(counter().tag).toContain(`data-custom-digits-counter="${widget.enabled}"`);
            });

            test("leaves data-to-value in Latin for the frontend script", () => {
                // Converting it here would make the animation double-convert.
                expect(counter().tag).toContain(`data-to-value="${widget.target}"`);
            });
        }
    );
});

// Only the widget that carries a digit set ships a map; the control must not,
// or code that converted everything unconditionally would still pass above.
describe("widget A: the digit map", () => {
    const widgetA = counters[0];
    const widgetB = counters[1];

    test("is attached to the converting widget", () => {
        expect(widgetA.tag).toContain("data-custom-digits-counter-map=");
    });

    test("includes the tenth digit", () => {
        // wp_json_encode escapes non-ASCII by default; accept either form so a
        // change in encoding is not reported as a conversion failure.
        expect(widgetA.tag).toMatch(/\\u0669|٩/);
    });

    test("is absent from the control widget", () => {
        expect(widgetB.tag).not.toContain("data-custom-digits-counter-map=");
    });
});

describe("assets", () => {
    test("the frontend script is enqueued", () => {
        // Proves register_assets() and enqueue_script() ran and the
        // elementor-frontend dependency resolved.
        expect(html).toContain("assets/js/custom-digits-counter.js");
    });
});

describe("php error log", () => {
    test("records no errors from this plugin", () => {
        const logContents = wp(state.container, ["eval-file", `${CONTAINER_SUITE}/read-log.php`]);

        // Scoped to this plugin: unrelated core and Elementor notices must not
        // fail the run.
        const ours = logContents
            .split("\n")
            .filter((line) => /Fatal|Warning|Deprecated|Notice/.test(line) && line.includes(PLUGIN_SLUG));

        expect(ours).toEqual([]);
    });
});
