<?php
/**
 * PHPUnit bootstrap.
 *
 * The plugin's classes guard against direct access with an ABSPATH check, so a
 * value is defined here before they are loaded. No WordPress is otherwise
 * involved: Digits is deliberately free of WordPress and Elementor, which is
 * what makes it testable without a full integration environment.
 *
 * @package CustomDigitsForElementorCounter
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once dirname( __DIR__ ) . '/vendor/autoload.php';
require_once dirname( __DIR__ ) . '/includes/class-digits.php';
