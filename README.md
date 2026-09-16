# Custom Digits for Elementor Counter

Lets Elementor's native **Counter** widget display and animate in any numeral system, by supplying your own set of ten digit characters — Arabic-Indic (٠١٢٣٤٥٦٧٨٩), Devanagari (०१२३४५६७८९), or any other characters you choose.

## Features

- Adds a **Custom Digits** section to the Counter widget's Content tab in the Elementor editor.
- A **Custom Digits** textarea taking ten comma-separated characters, in order from zero to nine.
- Digits are substituted server-side, so the counter's first paint already uses them — no flash of Latin numerals.
- Conversion continues on the frontend while Elementor's counter animation runs (via a `MutationObserver`), so the digits stay converted throughout the count-up, not just at the final value.
- Live validation in the editor: the field turns red as you type whenever the value isn't exactly ten single characters.
- No changes to existing counters — leaving the field empty means nothing is converted.

## Requirements

- WordPress 6.0+
- PHP 7.4+
- [Elementor](https://wordpress.org/plugins/elementor/) plugin, active

## Installation

1. Download or clone this plugin into `wp-content/plugins/custom-digits-for-elementor-counter`.
2. Activate **Custom Digits for Elementor Counter** from the WordPress Plugins screen.
3. Ensure Elementor is installed and active — the plugin will show an admin notice if it isn't.

## Usage

1. Edit a page with Elementor and add/select a **Counter** widget.
2. In the Content tab, open the new **Custom Digits** section.
3. Enter ten comma-separated characters, zero through nine. For Arabic-Indic:

   ```
   ٠,١,٢,٣,٤,٥,٦,٧,٨,٩
   ```

   Spaces around each character are ignored, so `٠, ١, ٢, …` works too.
4. Save/update — the counter will render and animate using those characters on the frontend.

The value is rejected as a whole — and the field outlined in red — unless it is exactly ten entries of exactly one character each. A rejected value is simply ignored at render time; the counter keeps its Latin digits.

## How it works

- [`includes/class-plugin.php`](includes/class-plugin.php) registers the widget control, validates the digit set, substitutes the digits in the rendered markup, and injects `data-custom-digits-counter="yes"` plus the digit set as JSON in `data-custom-digits-counter-map`. It also clears Elementor's element cache when the plugin version changes, since Elementor otherwise serves stored markup without re-running the render filter.
- [`assets/js/custom-digits-counter.js`](assets/js/custom-digits-counter.js) scans for counters flagged with `data-custom-digits-counter="yes"` as soon as it runs (and again on `DOMContentLoaded`/`load`, plus Elementor's `frontend/element_ready/counter.default` event for widgets rendered later). For each one it reads the digit set from the data attribute and watches the element with a `MutationObserver`, re-converting the text as Elementor's counter animation rewrites it.
- [`assets/js/custom-digits-counter-editor.js`](assets/js/custom-digits-counter-editor.js) and [`assets/css/custom-digits-counter-editor.css`](assets/css/custom-digits-counter-editor.css) run in the editor only, mirroring the PHP validation so an invalid value is flagged as it is typed. The rules are passed from PHP to the script, so the two validators cannot drift apart.
## Tests
[![Tests](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/tests.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/tests.yml)
[![Plugin Check](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/plugin-check.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/plugin-check.yml)
[![Smoke Test](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/smoke.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/smoke.yml)
[![codecov](https://codecov.io/gh/TarekNabil/custom-digits-for-elementor-counter/branch/main/graph/badge.svg)](https://codecov.io/gh/TarekNabil/custom-digits-for-elementor-counter)
Three layers, each answering a question the others cannot:

| Command | Covers |
| --- | --- |
| `composer test` | 27 PHPUnit tests over the pure digit logic in `Digits` — parsing, validation, substitution. No WordPress needed. |
| `npm test` | 39 Jest tests over both browser scripts in jsdom — editor validation, animation re-conversion, Elementor hook registration. |
| `npm run test:smoke` | 28 Jest tests that boot real WordPress + Elementor and assert a rendered page actually shows custom digits. Needs Docker. |

First-time setup: `composer install && npm install`.

### Smoke test

The unit suites run the pieces in isolation. The smoke test answers the one thing
they cannot: do the pieces work together inside real WordPress? It boots
WordPress and Elementor via `wp-env`, publishes a page containing two Counter
widgets, requests it over HTTP, and asserts the markup:

- the configured counter renders `٢٠٢٥`, not `2025`
- it carries `data-custom-digits-counter="yes"` and the JSON digit map
- a second counter with no digit set **keeps** Latin `1999` — the control that
  catches code converting everything unconditionally
- the frontend script is enqueued
- `debug.log` holds no errors from this plugin

Requires **Docker** to be running:

```bash
npm run test:smoke         # reuse the running environment (starts one if needed)
npm run test:smoke:local   # use sibling Elementor/theme checkouts instead of
                           # downloading them from wordpress.org
```

It is a Jest suite (`jest.smoke.config.js`), separate from `npm test` so the unit
tests stay fast and need no Docker. `npm run test:smoke -- --verbose
--reporters=default` lists each assertion, and `-t` filters as usual.

Artifacts land in `tests/smoke/output/` (gitignored) — the fetched HTML, the
captured `debug.log`, wp-env's own log, and the run's `state.json` — which is
where to look first when an assertion fails.

Note this is *not* an end-to-end test: `curl` runs no JavaScript, so the smoke
test proves the scripts are **enqueued**, never that they execute.

## Local development

This repo includes a [`.wp-env.json`](.wp-env.json) for [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/):

```bash
npm run env:start     # start it
npm run env:update    # restart, re-fetching the latest Elementor
npm run env:stop      # stop it
```

This spins up a local WordPress site on `http://localhost:8888` with Elementor
and the Hello Elementor theme installed from wordpress.org, and this plugin
mounted and active.

To develop against a **specific** Elementor build instead, add an
[`.wp-env.override.json`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/#wp-env-override-json)
(gitignored). wp-env *replaces* arrays rather than merging them, so repeat `"."`:

```json
{ "plugins": [ ".", "../elementor.4.2.4/elementor" ] }
```

## License

GPL-3.0-or-later — see [https://www.gnu.org/licenses/gpl-3.0.html](https://www.gnu.org/licenses/gpl-3.0.html)
