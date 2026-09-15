<?php
/**
 * Streams debug.log out of the container.
 *
 * Read through PHP rather than a container shell so the path resolves from
 * WP_CONTENT_DIR and needs no assumptions about the image's layout.
 *
 * @package CustomDigitsForElementorCounter
 */

$log = WP_CONTENT_DIR . '/debug.log';

echo file_exists( $log ) ? (string) file_get_contents( $log ) : '';
