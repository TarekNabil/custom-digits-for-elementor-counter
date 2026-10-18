<?php
/**
 * Prints sign-in cookies for the admin user, for the agent suite.
 *
 * Run inside the wp-env container via `wp eval-file`. The suite hands these to
 * the browser instead of typing a password into the login form: e2e withholds
 * screenshots from the model for the rest of a session once a secret is
 * filled, and the Elementor editor is hard to drive from the tree alone.
 *
 * @package CustomDigitsForElementorCounter
 */

$user = get_user_by( 'login', 'admin' );

if ( ! $user ) {
	echo "FAIL no admin user\n";
	exit( 1 );
}

$expiration = time() + HOUR_IN_SECONDS;
$token      = WP_Session_Tokens::get_instance( $user->ID )->create( $expiration );

echo 'COOKIE ', AUTH_COOKIE, ' ', wp_generate_auth_cookie( $user->ID, $expiration, 'auth', $token ), "\n";
echo 'COOKIE ', LOGGED_IN_COOKIE, ' ', wp_generate_auth_cookie( $user->ID, $expiration, 'logged_in', $token ), "\n";
