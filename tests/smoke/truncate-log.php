<?php
/**
 * Empties debug.log so the run only reports errors it caused.
 *
 * @package CustomDigitsForElementorCounter
 */

$log = WP_CONTENT_DIR . '/debug.log';

if ( file_exists( $log ) ) {
	file_put_contents( $log, '' );
}

echo "TRUNCATED {$log}\n";
