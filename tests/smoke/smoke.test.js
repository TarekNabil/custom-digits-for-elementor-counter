/**
 * Smoke test: does the plugin work inside real WordPress with real Elementor?
 *
 * The unit suites (composer test, npm test) exercise the pieces in isolation.
 * This one answers what they cannot — whether the pieces fit together — by
 * booting a real site, rendering a Counter widget and reading the HTML that a
 * visitor would receive.
 *
 * Not an end-to-end test: the page is fetched, not executed, so this proves the
 * scripts are enqueued, never that they run. That gap needs a browser.
 */

"use strict";

const fs = require("fs");

const { CONTAINER_SMOKE, PAGE_FILE, PLUGIN_SLUG, readState, wp } = require("./lib/environment");

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

// Fixture order: widget A carries the digit set, widget B is the control.
const [widgetA, widgetB] = counters;

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
    const results = wp(state.container, ["eval-file", `${CONTAINER_SMOKE}/boot-assertions.php`])
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
describe("widget A: a valid digit set (starts at 786)", () => {
    test("both counters were rendered", () => {
        expect(counters).toHaveLength(2);
    });

    test("renders converted digits", () => {
        expect(widgetA.text).toBe("٧٨٦");
    });

    test("carries the enabled flag", () => {
        expect(widgetA.tag).toContain('data-custom-digits-counter="yes"');
    });

    test("carries the digit map", () => {
        expect(widgetA.tag).toContain("data-custom-digits-counter-map=");
    });

    test("digit map includes the tenth digit", () => {
        // wp_json_encode escapes non-ASCII by default; accept either form so a
        // change in encoding is not reported as a conversion failure.
        expect(widgetA.tag).toMatch(/\\u0669|٩/);
    });

    test("leaves data-to-value in Latin for the frontend script", () => {
        // Converting it here would make the animation double-convert.
        expect(widgetA.tag).toContain('data-to-value="2025"');
    });
});

// Without this control, code that converted everything unconditionally would
// satisfy every assertion above.
describe("widget B: no digit set, the control (starts at 512)", () => {
    test("keeps Latin digits", () => {
        expect(widgetB.text).toBe("512");
    });

    test("carries the disabled flag", () => {
        expect(widgetB.tag).toContain('data-custom-digits-counter="no"');
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
        const logContents = wp(state.container, ["eval-file", `${CONTAINER_SMOKE}/read-log.php`]);

        // Scoped to this plugin: unrelated core and Elementor notices must not
        // fail the run.
        const ours = logContents
            .split("\n")
            .filter((line) => /Fatal|Warning|Deprecated|Notice/.test(line) && line.includes(PLUGIN_SLUG));

        expect(ours).toEqual([]);
    });
});
