/**
 * What tests/lib/counter-page.json actually contains.
 *
 * The smoke and e2e suites both assert on the same two widgets, so the numbers
 * and the digit set live here once. Editing the fixture without editing this
 * file is what breaks both suites at the same time, which is the intent: they
 * are describing one page.
 *
 * Widget A carries the digit set; widget B is the control, without which code
 * that converted every counter unconditionally would still pass.
 */

"use strict";

const WIDGETS = [
    {
        key: "a",
        label: "widget A: a valid digit set (786 -> 2025)",
        // Elementor renders the widget's attributes from this flag, so it also
        // doubles as the selector that tells the two counters apart.
        enabled: "yes",
        // Elementor renders starting_number as the element's text and animates
        // up to data-to-value in JavaScript, so the first value is the only one
        // the server converts.
        first: "٧٨٦",
        // Reaching this also proves data-to-value stayed Latin: Elementor
        // cannot parse a converted target, so the count-up would never arrive.
        last: "٢٠٢٥",
        // Anchored, and with no 0-9 in the class, so matching this already
        // proves no Latin digit is present. Elementor formats the animated
        // value with its `data-delimiter` setting ("٢,٠٢٥" rather than "٢٠٢٥"),
        // so separators are permitted and stripped before comparing to `last`.
        allowed: /^[٠-٩,.\s]+$/,
    },
    {
        key: "b",
        label: "widget B: the control, no digit set (512 -> 1999)",
        enabled: "no",
        first: "512",
        last: "1999",
        allowed: /^[0-9,.\s]+$/,
    },
];

/** The rendered counter element for a widget, by the flag the plugin stamps. */
function selectorFor(widget) {
    return `.elementor-counter-number[data-custom-digits-counter="${widget.enabled}"]`;
}

/** Removes group separators so a rendered value compares to a plain number. */
function digitsOnly(value) {
    return value.replace(/[,.\s]/g, "");
}

module.exports = { WIDGETS, digitsOnly, selectorFor };
