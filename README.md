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
[![codecov](https://codecov.io/gh/TarekNabil/custom-digits-for-elementor-counter/branch/main/graph/badge.svg)](https://codecov.io/gh/TarekNabil/custom-digits-for-elementor-counter)
## Local development

This repo includes a [`.wp-env.json`](.wp-env.json) for [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/):

```bash
npx @wordpress/env start
```

This spins up a local WordPress site with Elementor and the Hello Elementor theme pre-installed, and this plugin mounted and active.

## License

GPL-3.0-or-later — see [https://www.gnu.org/licenses/gpl-3.0.html](https://www.gnu.org/licenses/gpl-3.0.html)
