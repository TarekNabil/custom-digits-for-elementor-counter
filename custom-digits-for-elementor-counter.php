<?php
/**
 * Plugin Name:       Custom Digits for Elementor Counter
 * Description:       Display Elementor's native Counter in any numeral system or custom character set — Arabic-Indic, Devanagari, Latin, or your own.
 * Version:           1.0.0
 * Author:            Tarek Nabil
 * License:           GPL-3.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain:       custom-digits-for-elementor-counter
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Requires Plugins:  elementor
 *
 * @package CustomDigitsForElementorCounter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CUSTOM_DIGITS_COUNTER_VERSION', '1.0.0' );
define( 'CUSTOM_DIGITS_COUNTER_PLUGIN_FILE', __FILE__ );
define( 'CUSTOM_DIGITS_COUNTER_PLUGIN_PATH', plugin_dir_path( __FILE__ ) );
define( 'CUSTOM_DIGITS_COUNTER_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

function custom_digits_counter_init() {
	if ( ! did_action( 'elementor/loaded' ) ) {
		add_action( 'admin_notices', 'custom_digits_counter_missing_elementor_notice' );
		return;
	}

	require_once CUSTOM_DIGITS_COUNTER_PLUGIN_PATH . 'includes/class-plugin.php';
	\CustomDigitsForElementorCounter\Plugin::instance();
}
add_action( 'plugins_loaded', 'custom_digits_counter_init' );

function custom_digits_counter_missing_elementor_notice() {
	$message = sprintf(
		/* translators: %s: Elementor plugin name */
		esc_html__( 'Custom Digits for Elementor Counter requires %s to be installed and activated.', 'custom-digits-for-elementor-counter' ),
		'<strong>' . esc_html__( 'Elementor', 'custom-digits-for-elementor-counter' ) . '</strong>'
	);
	printf( '<div class="notice notice-warning is-dismissible"><p>%s</p></div>', wp_kses_post( $message ) );
}
