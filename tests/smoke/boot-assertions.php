<?php
/**
 * Boot assertions, run inside the wp-env container via `wp eval-file`.
 *
 * Prints one "PASS <label>" or "FAIL <label>" line per check. The calling script
 * tallies the lines, so add checks freely without touching the shell.
 *
 * @package CustomDigitsForElementorCounter
 */

$checks = [];

$checks['Plugin class is loaded']         = class_exists( 'CustomDigitsForElementorCounter\Plugin' );
$checks['Digits class is loaded']         = class_exists( 'CustomDigitsForElementorCounter\Digits' );
$checks['plugin version constant defined'] = defined( 'CUSTOM_DIGITS_COUNTER_VERSION' );
$checks['elementor/loaded has fired']     = (bool) did_action( 'elementor/loaded' );
$checks['Elementor Counter widget exists'] = (bool) \Elementor\Plugin::$instance->widgets_manager->get_widget_types( 'counter' );

// Every hook registered in Plugin::__construct(). A renamed or misspelled hook
// leaves the unit tests green but breaks the plugin entirely, which is exactly
// what this smoke test exists to catch.
$hooks = [
	'elementor/element/counter/section_counter/after_section_end',
	'elementor/widget/before_render_content',
	'elementor/widget/render_content',
	'elementor/frontend/after_register_scripts',
	'elementor/frontend/after_enqueue_scripts',
	'elementor/editor/after_enqueue_scripts',
	'elementor/editor/after_enqueue_styles',
	'init',
];

foreach ( $hooks as $hook ) {
	$checks[ "hook registered: {$hook}" ] = false !== has_filter( $hook );
}

// Proves maybe_flush_element_cache() ran on init.
$checks['rendered-version option is stamped'] =
	defined( 'CUSTOM_DIGITS_COUNTER_VERSION' )
	&& get_option( 'custom_digits_counter_rendered_version' ) === CUSTOM_DIGITS_COUNTER_VERSION;

foreach ( $checks as $label => $result ) {
	echo $result ? 'PASS ' : 'FAIL ', $label, "\n";
}
