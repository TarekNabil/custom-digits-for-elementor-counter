# Custom Digits for Elementor Counter

[![Tests](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/tests.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/tests.yml)
[![Plugin Check](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/plugin-check.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/plugin-check.yml)
[![Smoke Test](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/smoke.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/smoke.yml)
[![E2E Test](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/e2e.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/e2e.yml)
[![codecov](https://codecov.io/gh/TarekNabil/custom-digits-for-elementor-counter/branch/main/graph/badge.svg)](https://codecov.io/gh/TarekNabil/custom-digits-for-elementor-counter)
[![WordPress](https://img.shields.io/badge/WordPress-latest-0073aa?logo=wordpress&logoColor=white)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/smoke.yml)

Display and animate Elementor's native **Counter** widget in any numeral system,
by supplying your own set of ten digit characters.

Elementor's Counter always counts in Latin numerals — 1, 2, 3. This plugin adds a
**Custom Digits** field to that same widget so you can supply ten characters of
your choosing and have the counter display *and animate* with those instead. It
does not add a new widget: your existing layout, styling and animation settings
are untouched.

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [How it works](#how-it-works)
- [Development](#development)
- [License](#license)

---

## Features

- **Extends the widget you already use.** A **Custom Digits** section is added to
  the Counter widget's Content tab — no new widget, no migration.
- **No flash of Latin numerals.** Digits are substituted server-side, so the
  counter's very first paint already uses your characters.
- **Converted throughout the count-up.** A `MutationObserver` keeps converting
  while Elementor's animation rewrites the number, not just at the final value.
- **Live validation in the editor.** The field turns red as you type whenever the
  value isn't exactly ten single characters.
- **Any characters, not just numerals.** Arabic-Indic, Devanagari, Thai — or
  arbitrary symbols, if that's what you want.
- **Safe by default.** An empty or invalid value converts nothing, so existing
  counters are never altered unexpectedly.
- **Works with late-rendered widgets** — popups, AJAX content and the editor
  preview, via Elementor's `frontend/element_ready` hook.

## Requirements

| | |
| --- | --- |
| WordPress | 6.8 or later (Elementor itself requires 6.8) |
| PHP | 7.4 or later |
| [Elementor](https://wordpress.org/plugins/elementor/) | installed and active |

If Elementor is missing, the plugin stays dormant and shows an admin notice
rather than causing an error.

## Installation

1. Copy or clone the plugin into `wp-content/plugins/custom-digits-for-elementor-counter`.
2. Activate **Custom Digits for Elementor Counter** on the WordPress Plugins screen.
3. Make sure Elementor is installed and active.

## Usage

1. Edit a page with Elementor and select (or add) a **Counter** widget.
2. In the **Content** tab, open the **Custom Digits** section.
3. Enter ten comma-separated characters, in order from zero to nine.
4. Update the page. The counter renders and animates with those characters.

### Ready-made digit sets

Copy any of these straight into the field:

| Numeral system | Used for | Value to paste | Renders as |
| --- | --- | --- | --- |
| Arabic-Indic | Arabic | `٠,١,٢,٣,٤,٥,٦,٧,٨,٩` | ٠١٢٣٤٥٦٧٨٩ |
| Extended Arabic-Indic | Persian, Urdu | `۰,۱,۲,۳,۴,۵,۶,۷,۸,۹` | ۰۱۲۳۴۵۶۷۸۹ |
| Devanagari | Hindi, Marathi, Nepali | `०,१,२,३,४,५,६,७,८,९` | ०१२३४५६७८९ |
| Bengali | Bengali, Assamese | `০,১,২,৩,৪,৫,৬,৭,৮,৯` | ০১২৩৪৫৬৭৮৯ |
| Thai | Thai | `๐,๑,๒,๓,๔,๕,๖,๗,๘,๙` | ๐๑๒๓๔๕๖๗๘๙ |

### What counts as a valid value

The value must be **exactly ten entries of exactly one character each**, ordered
zero through nine. Spaces around each character are ignored, so
`٠, ١, ٢, …` works too.

Anything else is rejected **as a whole** rather than applied partially — a
malformed set can never produce a counter with some digits converted and others
left Latin. A rejected value is outlined in red in the editor and simply ignored
when the page renders, so the counter keeps its Latin digits.

## How it works

Conversion happens twice, on purpose: once on the server so the first paint is
already correct, and again in the browser so Elementor's animation can't undo it.

```
PHP render         →  markup already contains ٧٨٦
                      plus data-custom-digits-counter="yes"
                      and  data-custom-digits-counter-map='["٠","١",…]'

Elementor's JS     →  animates the number, writing Latin values
Frontend script    →  MutationObserver re-converts each write
```

| File | Responsibility |
| --- | --- |
| [`custom-digits-for-elementor-counter.php`](custom-digits-for-elementor-counter.php) | Plugin header, constants, Elementor dependency check, bootstrap. |
| [`includes/class-digits.php`](includes/class-digits.php) | Pure digit logic — parsing, validation, substitution. No WordPress or Elementor, which is what makes it directly testable. |
| [`includes/class-plugin.php`](includes/class-plugin.php) | Registers the control and the render/asset hooks, reads widget settings, and injects the data attributes. Also clears Elementor's element cache when the plugin version changes, since Elementor otherwise serves stored markup without re-running the render filter. |
| [`assets/js/custom-digits-counter.js`](assets/js/custom-digits-counter.js) | Frontend. Finds flagged counters, reads the digit map from the data attribute, and keeps the text converted through the count-up. |
| [`assets/js/custom-digits-counter-editor.js`](assets/js/custom-digits-counter-editor.js) | Editor only. Mirrors the PHP validation so an invalid value is flagged as it's typed. The rules are passed from PHP to the script, so the two validators cannot drift apart. |
| [`assets/css/custom-digits-counter-editor.css`](assets/css/custom-digits-counter-editor.css) | Editor only. The invalid-field state. |

Note that `data-to-value` is deliberately left in Latin: the frontend script
parses it to drive the animation, so converting it would double-convert.

## Development

```bash
composer install     # PHP dev dependencies (PHPUnit)
npm install          # JS dev dependencies (Jest, Playwright, wp-env)
```

### Test suites

Four layers, each answering a question the others cannot:

| Command | Covers | Needs Docker |
| --- | --- | --- |
| `composer test` | 27 PHPUnit tests over the pure digit logic in `Digits` — parsing, validation, substitution. | no |
| `npm test` | 39 Jest tests over both browser scripts in jsdom — editor validation, animation re-conversion, Elementor hook registration. | no |
| `npm run test:smoke` | 28 Jest tests that boot real WordPress + Elementor and assert a rendered page actually shows custom digits. | yes |
| `npm run test:e2e` | Playwright specs that load the page in real Chromium, Firefox and WebKit and watch the count-up animation live. | yes |

The first two are fast and need nothing installed beyond dependencies. Run them
constantly; run the other two before opening a pull request.

### Smoke test

The unit suites exercise the pieces in isolation. The smoke test answers what
they cannot: do the pieces work together inside real WordPress? It boots
WordPress and Elementor via `wp-env`, publishes a page with two Counter widgets,
requests it over HTTP, and asserts the markup:

- the configured counter renders `٧٨٦`, not `786`
- it carries `data-custom-digits-counter="yes"` and the JSON digit map
- `data-to-value` stays Latin, so the frontend script can still parse it
- a second counter with no digit set **keeps** Latin digits — the control that
  catches code converting everything unconditionally
- the frontend script is enqueued
- `debug.log` holds no errors from this plugin

```bash
npm run test:smoke   # reuses the running environment, starting one if needed
```

It is a Jest suite ([`jest.smoke.config.js`](jest.smoke.config.js)), kept separate
from `npm test` so the unit tests stay fast and need no Docker.
`npm run test:smoke -- --verbose --reporters=default` lists each assertion, and
`-t` filters as usual.

Artifacts land in `tests/smoke/output/` (gitignored) — the fetched HTML, the
captured `debug.log`, wp-env's log, and the run's `state.json`. That's the first
place to look when an assertion fails.

This is **not** an end-to-end test: the page is fetched, not executed, so it
proves the scripts are *enqueued*, never that they *run*.

### End-to-end test

This suite closes that gap. It boots its own `wp-env` environment, loads the
published page in real Chromium, Firefox and WebKit, and samples the counter
element on every animation frame while Elementor's own JavaScript animates it:

- the counter already shows custom digits on its first rendered frame, not just
  once the animation settles
- across the whole count-up (786 → 2025) every painted value is Arabic-Indic, and
  no Latin digit is ever visible
- the control counter (no digit set, 512 → 1999) stays Latin throughout
- the frontend script raises no console errors

Sampling uses `requestAnimationFrame` rather than a `MutationObserver` on
purpose. Observer callbacks are microtasks, so a second observer would see the
Latin value that exists between Elementor's write and this plugin's correction —
a state the browser never paints. `requestAnimationFrame` runs after the
microtask queue drains, so every sample is a value about to be shown.

```bash
npx playwright install --with-deps   # once, installs the three browsers
npm run test:e2e
```

Artifacts (HTML report, traces, videos, wp-env log) land in `playwright-report/`,
`test-results/` and `tests/e2e/output/` — all gitignored.

### Local WordPress environment

[`.wp-env.json`](.wp-env.json) configures [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/):

```bash
npm run env:start     # start it
npm run env:update    # restart, re-fetching the latest Elementor
npm run env:stop      # stop it
```

That gives you a WordPress site with Elementor and the Hello Elementor theme
installed from wordpress.org, and this plugin mounted and active.

Elementor and the theme track the latest wordpress.org releases, and wp-env
caches each download — so you stay on the version you last fetched until
`npm run env:update`. "Latest" refreshes deliberately, never silently.

To pin a **specific** Elementor while reproducing a bug, put a versioned URL in
an [`.wp-env.override.json`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/#wp-env-override-json)
(gitignored). wp-env *replaces* arrays rather than merging them, so repeat `"."`:

```json
{ "plugins": [ ".", "https://downloads.wordpress.org/plugin/elementor.4.2.4.zip" ] }
```

### Continuous integration

Four independent workflows run on every push to `main` and every pull request, so
a failure in one never masks another:

| Workflow | What it answers |
| --- | --- |
| [Tests](.github/workflows/tests.yml) | Do the units pass on PHP 7.4 – 8.5, and in jsdom? Uploads coverage to Codecov. |
| [Plugin Check](.github/workflows/plugin-check.yml) | Is the distributable zip publishable to wordpress.org? |
| [Smoke Test](.github/workflows/smoke.yml) | Does it work inside real WordPress + Elementor? |
| [E2E Test](.github/workflows/e2e.yml) | Does it work in a real browser, mid-animation? |

Plugin Check runs against the **pruned** file set — the checkout is reduced using
[`.distignore`](.distignore) first, so CI judges the plugin users actually
receive rather than the repository.

### Testing upcoming releases

Those four all test **current stable**. This plugin reads Elementor's counter
markup with a regex and hooks its render attributes, so a release that is
perfectly valid for Elementor can still break it — and the first run against a new
release would otherwise happen after users already have it.

[Pre-release Test](.github/workflows/prerelease.yml) runs the smoke and e2e suites
against the nightly builds of both — **weekly**, so an upstream change is caught
even when nothing here changed, and on **every pull request**, so your own changes
are checked against the nightlies before they merge:

| | Source |
| --- | --- |
| WordPress | [trunk nightly](https://wordpress.org/nightly-builds/wordpress-latest.zip), via `WP_ENV_CORE` |
| Elementor | [`nightly` rolling release](https://github.com/elementor/elementor/releases/tag/nightly), unpacked and mounted via a generated `.wp-env.override.json` |

Both URLs are fixed and always serve the newest build, so there is nothing to
resolve. The Elementor zip is unpacked rather than passed to wp-env as a URL:
wp-env names a plugin directory after the zip filename, so `elementor-nightly.zip`
would install under the slug `elementor-nightly`, which does not satisfy this
plugin's `Requires Plugins: elementor` header — WordPress would then refuse to
activate it at all. Note that Elementor's `nightly` tracks `main`, which is further ahead than
the next release — breakage shows up early, and occasionally for something that
gets fixed before it ships.

The job checks that both nightlies actually took effect before trusting the result —
WordPress by its `-alpha`/`-beta`/`-RC` marker, Elementor by comparing against the
version wordpress.org currently ships. Without that, reusing an already-running
environment would let a run pass while quietly testing current stable.

It is **advisory**: the job is `continue-on-error`, so a break in an unreleased
WordPress or Elementor reports neutral and never blocks a merge. Current stable is
what the other four workflows guard. Expect an occasional neutral run in the days
after an Elementor release, while wordpress.org catches up with the nightly's
version.

## License

[GPL-3.0-or-later](LICENSE) — see <https://www.gnu.org/licenses/gpl-3.0.html>
