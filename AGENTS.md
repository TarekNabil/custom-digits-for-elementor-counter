# AGENTS.md

Guidance for any coding or reviewing agent working in this repository.

`CLAUDE.md` is the deeper, Claude Code-specific reference and covers the same
ground in more detail. This file is the vendor-neutral entry point: it holds the
things an agent has to know before it edits or reviews, including the decisions
that look like mistakes but are not.

## What this plugin is

A WordPress plugin that extends Elementor's **native** Counter widget so it can
render its number in any numeral system — Arabic-Indic, Devanagari, or any ten
characters the user supplies. It does not add a widget of its own; it hooks the
existing one.

Requires WordPress 6.8+, PHP 7.4+, and Elementor (declared via
`Requires Plugins: elementor`).

Only eight files ship to wordpress.org. Everything else in the repository is
development tooling. `.distignore` is the single description of that boundary.

## Environment and what can actually run

Review sandboxes usually have Node but not PHP or Docker. Check before claiming
a suite passed, and **say plainly when a suite could not be executed** rather
than treating it as green.

| Need | Requires | Notes |
| --- | --- | --- |
| `npm test` (Jest) | `npm ci` | jsdom only. No WordPress, no Docker. Usually runnable. |
| `composer test` (PHPUnit) | PHP 7.4+, Composer, `composer install` | `vendor/` is untracked, so a fresh clone has no `phpunit` binary. |
| `npm run test:smoke` | Docker + `@wordpress/env` | Boots real WordPress and Elementor containers. |
| `npm run test:e2e` | Docker + Playwright browsers | Drives Chromium/Firefox/WebKit. |

If PHP tooling is unavailable, `tests/DigitsTest.php` cannot run. Reason about
`includes/class-digits.php` statically and say that is what you did.

## Which suite owns what

Each suite answers one question. Add a new assertion to the suite that owns the
question, not to whichever is easiest to extend.

- **PHPUnit** (`tests/`) — digit-set parsing and conversion in PHP, no WordPress.
- **Jest** (`tests/js/`) — frontend script logic in jsdom: refusal branches, the
  MutationObserver, the Elementor hooks.
- **Smoke** (`tests/smoke/`) — does it boot inside real WordPress: classes, hooks,
  no PHP errors, and that the **server** sent converted digits.
- **E2E** (`tests/e2e/`) — what the page does in real browsers: the count-up, no
  flash of Latin digits, the control widget.

`tests/lib/` holds what smoke and e2e share: the wp-env plumbing, the Elementor
fixture, and `fixture.js` with the values both assert against.

Smoke deliberately does **not** assert on render attributes or the enqueued
script; e2e proves those more strongly by executing the page. The one real
overlap is the server-rendered first value, because only smoke can distinguish a
server-side conversion from a fast client-side one.

## Deliberate decisions that look like defects

Please do not "fix" these without discussion.

1. **`plugin-check.yml` leaves `checks`, `categories` and the severity inputs
   unset.** Empty means *every* check in *every* category — the widest the action
   runs. Naming them would freeze coverage at today's 34 checks and silently skip
   whatever Plugin Check adds later. The severity inputs filter only when
   non-empty, so empty is already unfiltered.
2. **`plugin-check.yml` prunes the checkout with `rsync` and `rm -rf` before
   running.** Plugin Check has no `.distignore` support, so this is what makes CI
   judge the plugin users receive rather than the repository. The rsync
   `--exclude-from` semantics match what `10up/action-wordpress-plugin-deploy`
   uses to build the zip.
3. **`strict: 'true'` in `plugin-check.yml` is intentional.** Warnings fail the
   build. This couples `main` to plugin-check's release cadence, and that is the
   accepted trade.
4. **`.distignore` must mirror `.gitignore`.** Neither `wp dist-archive` nor the
   deploy action consults `.gitignore`, so anything ignored there that can land in
   the working tree has to be repeated in `.distignore` or a release built from a
   dirty tree will ship it. When you add to one, check the other.
5. **`prerelease.yml` does not use `continue-on-error`.** It reports failure
   honestly and is kept out of the required checks instead. Those are different
   things; the comment in the file explains why.
6. **Both `add_render_attributes()` and `add_frontend_data()` inject the data
   attribute.** The first runs on `elementor/widget/before_render_content`; the
   second is a `render_content` fallback that no-ops when the attribute is already
   present. That is not duplication.
7. **A malformed digit set is rejected whole, never partially applied.** Anything
   other than exactly ten single characters is ignored entirely, so a counter can
   never render with some digits converted and others not.

## Conventions

**PHP**

- Indentation is **tabs**, per WordPress Coding Standards. (`CLAUDE.md` currently
  says 4 spaces for PHP; the code is tabs and the code is right.)
- Namespace `CustomDigitsForElementorCounter`; function/hook/constant prefix
  `custom_digits_counter_` / `CUSTOM_DIGITS_COUNTER_`.
- `if ( ! defined( 'ABSPATH' ) ) { exit; }` at the top of every file.
- Escape on output (`esc_html`, `esc_attr`, `wp_kses_post`); sanitize on input.
- Text domain `custom-digits-for-elementor-counter` on every user-facing string.
- DocBlocks on classes and public methods. Comments explain **why**, not what.

**JavaScript**

- Indentation is 2 spaces, with double-quoted strings (Prettier defaults).
- Vanilla JS, no jQuery. Wrapped in an IIFE with `'use strict'`.
- Check `elementorFrontend` exists before using it.
- Namespace globals as `customDigitsCounter*`.

**Elementor integration**

- Always check `$widget->get_name() === 'counter'` before acting.
- Read settings via `get_settings_for_display()`.
- Handle late-rendered widgets (AJAX, popups, editor preview) — the frontend
  script uses a MutationObserver for exactly this.

## Before opening a PR

Run what your environment supports, and report honestly which of these you could
not run:

```bash
npm ci && npm test          # Jest, jsdom
composer install && composer test   # PHPUnit, needs PHP
npm run test:smoke          # needs Docker
npm run test:e2e            # needs Docker + browsers
```

If you touched `.distignore`, confirm the shipped set is still exactly the
intended files:

```bash
rsync -a --exclude-from=.distignore --exclude='.git/' ./ /tmp/dist/ \
  && find /tmp/dist -type f | sort
```
