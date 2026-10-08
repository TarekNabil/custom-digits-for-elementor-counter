# Custom Digits for Elementor Counter

[![Tests](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/tests.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/tests.yml)
[![Plugin Check](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/plugin-check.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/plugin-check.yml)
[![Smoke Test](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/smoke.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/smoke.yml)
[![E2E Test](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/e2e.yml/badge.svg)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/e2e.yml)
[![codecov](https://codecov.io/gh/TarekNabil/custom-digits-for-elementor-counter/branch/main/graph/badge.svg)](https://codecov.io/gh/TarekNabil/custom-digits-for-elementor-counter)
[![WordPress](https://img.shields.io/badge/WordPress-latest-0073aa?logo=wordpress&logoColor=white)](https://github.com/TarekNabil/custom-digits-for-elementor-counter/actions/workflows/smoke.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-WordPress%20Playground-3858E9?logo=wordpress&logoColor=FFFFFF&labelColor=3858E9)](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/TarekNabil/custom-digits-for-elementor-counter/main/.wordpress-org/blueprints/blueprint.json)

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
- [Development](#development)
- [License](#license)

---

## Features

- **Extends the widget you already use.** A **Custom Digits** section is added to
  the Counter widget's Content tab — no new widget, no migration.
- **Any characters, not just numerals.** Arabic-Indic, Devanagari, Thai — or
  arbitrary symbols, if that's what you want.
- **Safe by default.** An empty or invalid value converts nothing, so existing
  counters are never altered unexpectedly.
- **Works with late-rendered widgets** — popups, AJAX content and the editor
  preview.

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

### Example digit sets

**Any** ten single characters work — these are just common ones, ready to copy
straight into the field. Nothing here is a fixed list of what the plugin supports.

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

### Translation plugins

Each counter keeps its own digit set, saved with the rest of its settings, so
every language can show its own digits — Latin on the English page,
Arabic-Indic on the Arabic one. Polylang and Loco Translate work with this
as-is; WPML and GTranslate need a few steps.

#### Polylang

No setup needed. Every language has its own page, with its own widgets. Open
the translation in Elementor, select the counter and enter that language's
digit set in its Custom Digits field.

#### Loco Translate

No setup needed. Loco Translate translates theme and plugin text, not page
content, so each page has a single version. Enter the digit set once in the
counter's Custom Digits field, and every visitor sees it.

#### WPML

Requires **WPML Multilingual CMS** and **WPML String Translation**. WPML only
translates Elementor widgets while String Translation is active.

1. **Fill in the field on the original page, even if that language uses Latin
   digits.** WPML only sends fields that have a value, so an empty field never
   reaches the translation editor. For Latin digits, enter
   `0,1,2,3,4,5,6,7,8,9` — the counter looks exactly as it did before.
2. **Translate the page.** The value appears as **Counter: Custom Digits**:
   - **Classic Translation Editor** — listed with the counter's other fields,
     like any other text.
   - **Advanced Translation Editor** — hidden by default, because the editor
     treats content made only of numbers and punctuation as not needing
     translation. Search for the value in the editor's search bar to make it
     appear.
3. **Enter the target language's digits**, keeping the plain comma between
   them, for example `٠,١,٢,٣,٤,٥,٦,٧,٨,٩`. A localized comma such as the
   Arabic `،` is rejected, and the counter falls back to Latin digits — worth
   checking if you use automatic translation.

#### GTranslate

Requires the free **GTranslate Visual Addon** plugin, which stores manual
translation fixes. GTranslate's own translation can't change the counter: the
count-up redraws the number on every frame.

1. **Fill in the field on the original page, even if that language uses Latin
   digits.** A counter with an empty field is left alone in every language. For
   Latin digits, enter `0,1,2,3,4,5,6,7,8,9`.
2. **Save a pair in GTranslate Visual Addon.** Open its language tab and use
   **New translation**:
   - **Original text** — the counter's digit set, as entered in the field;
   - **Your custom translation** — that language's digits, keeping the plain
     comma between them, for example `٠,١,٢,٣,٤,٥,٦,٧,٨,٩`.
3. **Switch the page to that language.** Once GTranslate has translated the
   page, the counter changes to the saved set, including the count-up.

Counters with the same digit set share one pair. The free version of the addon
allows 10 pairs in one language. Tested with GTranslate's free widget; its paid
plans translate pages on GTranslate's servers and have not been tested.

## Development

```bash
composer install     # PHP dev dependencies (PHPUnit)
npm install          # JS dev dependencies (Jest, Playwright, wp-env)
```

### Tests

| Command | Covers | Needs Docker |
| --- | --- | --- |
| `composer test` | PHPUnit over the pure digit logic in [`Digits`](includes/class-digits.php) — parsing, validation, substitution. | no |
| `npm test` | Jest over both browser scripts in jsdom. | no |
| `npm run test:smoke` | Boots real WordPress + Elementor and checks the rendered markup. | yes |
| `npm run test:e2e` | Playwright in Chromium, Firefox and WebKit, sampling the count-up as it animates. | yes |

## License

[GPL-3.0-or-later](LICENSE) — see <https://www.gnu.org/licenses/gpl-3.0.html>
