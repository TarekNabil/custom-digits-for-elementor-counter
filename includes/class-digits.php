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
	 * @param string   $text   Text containing Latin digits.
	 * @param string[] $digits Ten replacement characters indexed 0-9.
	 * @return string Text with each Latin digit swapped for its custom equivalent.
	 */
	public static function convert( $text, $digits ) {
		return str_replace( self::LATIN, $digits, $text );
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
