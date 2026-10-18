<?php
/**
 * Digit set parsing and substitution.
 *
 * @package CustomDigitsForElementorCounter
 */

namespace CustomDigitsForElementorCounter;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Pure digit-handling logic, free of WordPress and Elementor.
 *
 * Kept separate from {@see Plugin} so the substitution rules can be exercised
 * directly by the test suite: nothing here reads widget settings, touches
 * options or calls a WordPress function, so every method is decided entirely
 * by its arguments.
 */
final class Digits {

	/**
	 * Number of digits a custom digit set must define, one per decimal digit.
	 *
	 * @var int
	 */
	const COUNT = 10;

	/**
	 * Separator between digits in the "Custom Digits" control.
	 *
	 * @var string
	 */
	const SEPARATOR = ',';

	/**
	 * Latin digits, in the order a custom set must replace them.
	 *
	 * @var string[]
	 */
	const LATIN = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' ];

	/**
	 * Matches Elementor's counter number span and captures its inner text.
	 *
	 * @var string
	 */
	const COUNTER_NUMBER_PATTERN = '/(<span[^>]*\sclass=(["\'])(?:[^"\']*\s)?elementor-counter-number(?:\s[^"\']*)?\2[^>]*>)([^<]*)(<\/span>)/';

	/**
	 * Validates a raw "Custom Digits" string into a digit map.
	 *
	 * The value is accepted only as exactly ten separated single characters,
	 * ordered zero through nine. Anything else — too few or too many entries, an
	 * empty entry, or an entry longer than one character — is rejected as a whole
	 * rather than partially applied, so a malformed set can never produce a
	 * counter with some digits converted and others not.
	 *
	 * @param mixed $value Raw control value.
	 * @return string[] Ten digit characters indexed 0-9, or an empty array if invalid.
	 */
	public static function parse( $value ) {
		if ( ! is_string( $value ) || '' === trim( $value ) ) {
			return [];
		}

		$parts = explode( self::SEPARATOR, $value );

		if ( self::COUNT !== count( $parts ) ) {
			return [];
		}

		$digits = [];

		foreach ( $parts as $part ) {
			$part = trim( $part );

			if ( 1 !== self::character_length( $part ) ) {
				return [];
			}

			$digits[] = $part;
		}

		return $digits;
	}

	/**
	 * Replaces Latin digits in a string using a custom digit set.
	 *
	 * A single pass, as the frontend script converts: a set that reuses Latin
	 * digits, such as 9,8,7,...,0, must not have one replacement feed the next,
	 * or the server-rendered value would differ from the animated one.
	 *
	 * @param string   $text   Text containing Latin digits.
	 * @param string[] $digits Ten replacement characters indexed 0-9.
	 * @return string Text with each Latin digit swapped for its custom equivalent,
	 *                unchanged if the set does not contain ten entries.
	 */
	public static function convert( $text, $digits ) {
		return self::replace_set( $text, self::LATIN, $digits );
	}

	/**
	 * Rewrites text from one digit set into another, position for position.
	 *
	 * A single pass, so a target set that reuses characters of the source set in
	 * other positions cannot have one replacement feed the next.
	 *
	 * @param string   $text Text written in the source set.
	 * @param string[] $from Ten characters indexed 0-9 the text is written in.
	 * @param string[] $to   Ten characters indexed 0-9 to write it in instead.
	 * @return string Rewritten text, unchanged if either set does not contain ten entries.
	 */
	public static function replace_set( $text, $from, $to ) {
		if ( self::COUNT !== count( $from ) || self::COUNT !== count( $to ) ) {
			return $text;
		}

		return strtr( $text, array_combine( $from, $to ) );
	}

	/**
	 * Applies a digit set to the value inside Elementor's counter number span.
	 *
	 * Only the first counter number in the markup is converted, and only its text
	 * content: attributes on the span carry the unconverted value for the frontend
	 * script, so rewriting them would double-convert during animation.
	 *
	 * @param string   $content Rendered widget markup.
	 * @param string[] $digits  Ten replacement characters indexed 0-9.
	 * @return string Markup with the counter value converted, unchanged if the set
	 *                is empty or the pattern could not be applied.
	 */
	public static function convert_in_markup( $content, $digits ) {
		if ( empty( $digits ) ) {
			return $content;
		}

		$digits = self::escape( $digits );
		$output = preg_replace_callback(
			self::COUNTER_NUMBER_PATTERN,
			function ( $matches ) use ( $digits ) {
				return $matches[1] . self::convert( $matches[3], $digits ) . $matches[4];
			},
			$content,
			1
		);

		if ( null === $output ) {
			return $content;
		}

		return $output;
	}

	/**
	 * Escapes each character of a digit set for use as HTML text.
	 *
	 * A set may hold any ten characters, including `<`, `&` or quotes, so it must
	 * be escaped before going into markup. htmlspecialchars() rather than
	 * esc_html() keeps this class free of WordPress. ENT_HTML5 writes `'` as
	 * `&apos;`, an entity with no digits in it for a later replacement to alter.
	 *
	 * @param string[] $digits Ten characters indexed 0-9.
	 * @return string[] The same characters, HTML-escaped, in the same order.
	 */
	public static function escape( $digits ) {
		return array_map(
			function ( $digit ) {
				return htmlspecialchars( $digit, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			},
			$digits
		);
	}

	/**
	 * Counts characters in a UTF-8 string without requiring mbstring.
	 *
	 * @param string $text Text to measure.
	 * @return int Character count, or -1 if the text is not valid UTF-8.
	 */
	public static function character_length( $text ) {
		if ( function_exists( 'mb_strlen' ) ) {
			return \mb_strlen( $text, 'UTF-8' );
		}

		$count = preg_match_all( '/./us', $text );

		return false === $count ? -1 : $count;
	}
}
