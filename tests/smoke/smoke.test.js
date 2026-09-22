/**
 * Smoke test: does the plugin boot inside real WordPress with real Elementor,
 * and does the server send converted digits?
 *
 * Deliberately narrow. The page is fetched, not executed, so this suite can
 * only read what the server produced. Everything about what the page then
 * *does* — the count-up animation, the control widget staying Latin, the
 * script actually running — belongs to tests/e2e, which drives real browsers
 * against the same fixture and is strictly stronger for anything rendered.
 *
 * What is left here is what a browser cannot see: that the classes loaded, the
 * hooks registered, no PHP error was raised, and the markup left the server
 * already converted. That last one looks like something e2e covers, and does
 * not: e2e's first sample is taken after the frontend script has run, so it
 * cannot tell a server-side conversion from a fast client-side one.
 */

"use strict";

const fs = require("fs");

const { CONTAINER_SUITE, PAGE_FILE, PLUGIN_SLUG, readState, wp } = require("./lib/environment");
const { WIDGETS } = require("../lib/fixture");

const state = readState();
const html = fs.readFileSync(PAGE_FILE, "utf8");

/**
 * Pulls out the text of Elementor's counter number elements, in document order.
 *
 * Asserting against the whole page would work, but a failure then prints the
 * entire document. Comparing the element's text directly reports
 * `Expected "٧٨٦" / Received "786"`, which names the actual problem.
 */
function counterValues(markup) {
    const pattern = /<span[^>]*\bclass="[^"]*\belementor-counter-number\b[^"]*"[^>]*>([^<]*)<\/span>/g;

    return [...markup.matchAll(pattern)]
        .filter((match) => !/elementor-counter-number-(prefix|suffix)/.test(match[0]))
        .map((match) => match[1]);
}

const counters = counterValues(html);

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
// data-to-value in JavaScript, so this first value is the only one the server
// converts — and the only conversion a plain fetch can observe.
describe("server-rendered digits", () => {
    test("every fixture widget was rendered", () => {
        expect(counters).toHaveLength(WIDGETS.length);
    });

    // Fixture order is document order, so the widgets line up with the markup.
    // Widget B is the control: without it, code that converted every counter
    // unconditionally would satisfy the assertion above it.
    test.each(WIDGETS.map((widget, index) => [widget.label, widget, index]))(
        "%s renders its first value",
        (_label, widget, index) => {
            expect(counters[index]).toBe(widget.first);
        }
    );
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
