# Claude Development Guidelines for Custom Digits for Elementor Counter

## Project Overview

This is a WordPress plugin that extends Elementor's native Counter widget to support Arabic-Indic (non-Latin) numbers. The plugin integrates seamlessly with Elementor's architecture and hooks system.

**Model preference:** Claude Opus 5 for code generation tasks.

## WordPress Plugin Development Standards

### Security & Sanitization
- **Always escape output:** Use `esc_html()`, `esc_attr()`, `esc_js()`, `wp_kses_post()` depending on context.
- **Sanitize inputs:** Use `sanitize_key()`, `sanitize_text_field()`, `intval()` on user/setting inputs.
- **Nonce verification:** Include nonces for any form submissions or AJAX requests (not applicable to this addon yet).
- **Capability checks:** Use `current_user_can()` when accessing admin features.

### Code Structure
- Use namespaces: `CustomDigitsForElementorCounter` for all classes.
- Singleton pattern for main plugin class (already implemented in `Plugin` class).
- Define constants for paths/URLs at plugin init: `CUSTOM_DIGITS_COUNTER_VERSION`, `CUSTOM_DIGITS_COUNTER_PLUGIN_FILE`, etc.
- Check `ABSPATH` at the top of every file: `if ( ! defined( 'ABSPATH' ) ) { exit; }`

### Naming Conventions
- Plugin prefix for all functions/hooks/actions: `custom_digits_counter_` (custom-digits-for-elementor-counter shortened).
- Class names: PascalCase, namespaced.
- Hook names: `custom_digits_counter_hook_name` for custom hooks.
- JavaScript global namespace prefix: `customDigitsCounter` or wrap in IIFE (already done).

### Dependencies & Version Requirements
- Minimum WordPress: 6.0
- Minimum PHP: 7.4
- Required plugin: Elementor (checked at init, shows admin notice if missing)
- Always declare in main plugin file header.

## Elementor Addon Development Guidelines

### Widget Integration
- **Hook into Elementor's element lifecycle:**
  - `elementor/element/{widget_name}/section_{section_name}/after_section_end` — add custom sections/controls after core sections.
  - `elementor/widget/render_content` — modify rendered widget output (filter: `$content, $widget`).
  - Check widget name: `$widget->get_name()` before modifying.

- **Controls:**
  - Use Elementor's `Controls_Manager` enum for control types.
  - Always set `'default'` value for controls.
  - Use `esc_html__()` and text domain `'custom-digits-for-elementor-counter'` for all control labels.
  - Store settings: `$widget->get_settings_for_display()` to read control values.

- **Frontend Scripts:**
  - Register with `wp_register_script()` with dependencies and version.
  - Enqueue with `wp_enqueue_script()`.
  - Use Elementor's frontend hooks: `elementor/frontend/after_register_scripts` (register), `elementor/frontend/after_enqueue_scripts` (enqueue).

### Frontend JavaScript
- Use Elementor's hook system: `elementorFrontend.hooks.addAction( 'frontend/element_ready/{widget_name}.{skin_name}', callback )`.
- Handle late-loaded widgets (AJAX-rendered content): listen to `elementor/frontend/init` event as fallback.
- Avoid jQuery if possible; use vanilla JS (already done in this addon).
- Wrap in IIFE with `'use strict'` (already done).
- Global `elementorFrontend` should be checked before use.

### Data Attributes
- Store widget-specific data on DOM elements using `data-*` attributes.
- Prefix custom attributes: `data-custom-digits-counter-{attribute}`.
- Inject attributes with `$widget->add_render_attribute()` on the `elementor/widget/before_render_content` action (see `add_render_attributes`). The counter widget prints its number element from the `counter` render-attribute key, so additions merge with Elementor's own class/data attributes.
- `add_frontend_data` remains only as a `render_content` fallback: it no-ops when the attribute is already present and returns the original content if `preg_replace()` fails.

## Code Quality Standards

### PHP
- Follow [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/).
- 4-space indentation (not tabs).
- DocBlock comments on classes and public methods.
- No unnecessary comments — only explain WHY, not WHAT.

### JavaScript
- Use `'use strict'` mode.
- Avoid ES6+ features beyond what's widely supported (or transpile).
- Use vanilla JS over jQuery when possible.
- Prefix all globals/namespaces with plugin prefix.

### Testing
- Test with local WordPress environment: `npx @wordpress/env start`.
- Test with Elementor's Counter widget in the editor and frontend.
- Test both Latin and Arabic-Indic formats; verify animations work correctly.
- Test with different browser versions (especially for MutationObserver support).

## Project Structure

```
├── custom-digits-for-elementor-counter.php  # Main plugin file, init hooks
├── includes/
│   └── class-plugin.php                 # Main Plugin singleton, controls & frontend data
├── assets/
│   └── js/custom-digits-counter.js      # Frontend digit conversion & mutation observer
├── README.md                            # User-facing docs
├── .wp-env.json                         # Local dev environment config
└── CLAUDE.md                            # This file
```

## Common Tasks & Patterns

### Adding a New Control to the Counter Widget
```php
$widget->add_control(
    'custom_digits_counter_new_control',
    [
        'label'   => esc_html__( 'Control Label', 'custom-digits-for-elementor-counter' ),
        'type'    => \Elementor\Controls_Manager::CONTROL_TYPE,
        'default' => 'default_value',
    ]
);
```

### Accessing Control Values in Frontend
```php
$settings = $widget->get_settings_for_display();
$value = sanitize_key( $settings['custom_digits_counter_new_control'] ?? 'default' );
```

### Hooking Into Elementor Frontend Events (JS)
```javascript
elementorFrontend.hooks.addAction(
    'frontend/element_ready/counter.default',
    function( $scope ) {
        var element = $scope[0].querySelector('.elementor-counter-number');
        // Your logic here
    }
);
```

## When Adding Features

1. **Check Elementor's current version** for hook availability (currently targeting Elementor 4.2.4+).
2. **Always provide fallbacks** for late-rendered widgets (AJAX, dynamic content).
3. **Maintain backward compatibility** — don't break existing counter functionality.
4. **Document public APIs** if exposing custom hooks or filters.
5. **Localize strings** — all user-facing text must use `esc_html__()` with the text domain.

## Debugging

- Enable WordPress debugging in `.wp-env.json`: `"WP_DEBUG_LOG": true`.
- Check `wp-content/debug.log` in the local environment.
- Use browser DevTools console for frontend JS errors.
- Test with Elementor's debug mode if needed.

## References

- [WordPress Plugin Handbook](https://developer.wordpress.org/plugins/)
- [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/)
- [Elementor Developer Docs](https://developers.elementor.com/)
- [Elementor Widget Development](https://developers.elementor.com/create-a-simple-widget/)
