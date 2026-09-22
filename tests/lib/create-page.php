<?php
/**
 * Creates the test page from the Elementor fixture, for whichever suite asks.
 *
 * Run inside the wp-env container via `wp eval-file <file> <title>`: wp-cli puts
 * the trailing arguments in $args, so the suites share this file and differ only
 * by the page title they pass. Echoes the new post id and its permalink for the
 * calling script to pick up.
 *
 * @package CustomDigitsForElementorCounter
 */

$title = isset( $args[0] ) ? (string) $args[0] : 'Custom Digits test';

$fixture = __DIR__ . '/counter-page.json';
$data    = file_get_contents( $fixture );

if ( false === $data || null === json_decode( $data, true ) ) {
	echo "FAIL could not read or parse {$fixture}\n";
	exit( 1 );
}

$post_id = wp_insert_post(
	[
		'post_title'   => $title,
		'post_status'  => 'publish',
		'post_type'    => 'page',
		'post_content' => '',
	],
	true
);

if ( is_wp_error( $post_id ) ) {
	echo 'FAIL wp_insert_post: ', $post_id->get_error_message(), "\n";
	exit( 1 );
}

// Elementor stores its tree slashed; wp_slash keeps the JSON intact through the
// meta API rather than letting it strip the escaping.
update_post_meta( $post_id, '_elementor_data', wp_slash( $data ) );
update_post_meta( $post_id, '_elementor_edit_mode', 'builder' );
update_post_meta( $post_id, '_elementor_template_type', 'wp-post' );
update_post_meta( $post_id, '_elementor_version', defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : '0' );

echo 'POSTID ', $post_id, "\n";
echo 'PERMALINK ', get_permalink( $post_id ), "\n";
