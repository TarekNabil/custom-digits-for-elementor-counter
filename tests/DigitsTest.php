<?php
/**
 * Tests for the digit parsing and substitution rules.
 *
 * @package CustomDigitsForElementorCounter
 */

declare(strict_types=1);

namespace CustomDigitsForElementorCounter\Tests;

use CustomDigitsForElementorCounter\Digits;
use PHPUnit\Framework\TestCase;

/**
 * @covers \CustomDigitsForElementorCounter\Digits
 */
final class DigitsTest extends TestCase {

	/**
	 * Arabic-Indic digits zero through nine, as the control expects them.
	 *
	 * @var string
	 */
	const ARABIC_INDIC = '٠,١,٢,٣,٤,٥,٦,٧,٨,٩';

	/**
	 * @return string[]
	 */
	private function arabic_indic_map(): array {
		return [ '٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩' ];
	}

	public function test_parses_a_valid_arabic_indic_set(): void {
		$this->assertSame( $this->arabic_indic_map(), Digits::parse( self::ARABIC_INDIC ) );
	}

	public function test_parses_a_latin_set_unchanged(): void {
		$this->assertSame(
			[ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' ],
			Digits::parse( '0,1,2,3,4,5,6,7,8,9' )
		);
	}

	public function test_ignores_whitespace_around_each_digit(): void {
		$this->assertSame(
			$this->arabic_indic_map(),
			Digits::parse( ' ٠ , ١ ,٢,٣,٤,٥,٦,٧,٨, ٩ ' )
		);
	}

	public function test_accepts_multibyte_digits_from_other_scripts(): void {
		$devanagari = [ '०', '१', '२', '३', '४', '५', '६', '७', '८', '९' ];

		$this->assertSame( $devanagari, Digits::parse( implode( ',', $devanagari ) ) );
	}

	public function test_accepts_any_single_character_not_only_numerals(): void {
		$this->assertSame(
			[ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j' ],
			Digits::parse( 'a,b,c,d,e,f,g,h,i,j' )
		);
	}

	/**
	 * A malformed set must be rejected whole, never applied partially: a counter
	 * with some digits converted and others left Latin is worse than no change.
	 *
	 * @dataProvider provide_invalid_values
	 *
	 * @param mixed  $value  Raw control value.
	 * @param string $reason Why it is invalid.
	 */
	public function test_rejects_invalid_values( $value, string $reason ): void {
		$this->assertSame( [], Digits::parse( $value ), $reason );
	}

	/**
	 * @return array<string, array{0: mixed, 1: string}>
	 */
	public function provide_invalid_values(): array {
		return [
			'empty string'            => [ '', 'unset control' ],
			'whitespace only'         => [ "  \t ", 'no digits supplied' ],
			'null'                    => [ null, 'not a string' ],
			'integer'                 => [ 123, 'not a string' ],
			'array'                   => [ [ '1', '2' ], 'not a string' ],
			'nine digits'             => [ '٠,١,٢,٣,٤,٥,٦,٧,٨', 'too few entries' ],
			'eleven digits'           => [ '٠,١,٢,٣,٤,٥,٦,٧,٨,٩,١٠', 'too many entries' ],
			'no separators'           => [ '٠١٢٣٤٥٦٧٨٩', 'single entry of ten characters' ],
			'two characters in entry' => [ '٠٠,١,٢,٣,٤,٥,٦,٧,٨,٩', 'entry longer than one character' ],
			'empty entry'             => [ '٠,,٢,٣,٤,٥,٦,٧,٨,٩', 'entry with no character' ],
			'trailing separator'      => [ '٠,١,٢,٣,٤,٥,٦,٧,٨,٩,', 'eleven entries, last empty' ],
			'wrong separator'         => [ '٠;١;٢;٣;٤;٥;٦;٧;٨;٩', 'semicolons are not the separator' ],
		];
	}

	public function test_converts_each_latin_digit(): void {
		$this->assertSame( '١٢٣٤٥٦٧٨٩٠', Digits::convert( '1234567890', $this->arabic_indic_map() ) );
	}
	//I think this test is not important because our converter gets numbers only from the native counter, but I will leave it here for now.
	public function test_conversion_preserves_surrounding_characters(): void {
		$this->assertSame(
			'١,٢٣٤.٥٦ %',
			Digits::convert( '1,234.56 %', $this->arabic_indic_map() )
		);
	}
	//same, I think this test is not important because our converter gets numbers only from the native counter, but I will leave it here for now.
	public function test_conversion_leaves_text_without_digits_alone(): void {
		$this->assertSame( 'no digits here', Digits::convert( 'no digits here', $this->arabic_indic_map() ) );
	}

	public function test_converts_the_counter_value_inside_markup(): void {
		$markup = '<span class="elementor-counter-number" data-duration="2000">2025</span>';

		$this->assertSame(
			'<span class="elementor-counter-number" data-duration="2000">٢٠٢٥</span>',
			Digits::convert_in_markup( $markup, $this->arabic_indic_map() )
		);
	}

	public function test_markup_conversion_leaves_attributes_untouched(): void {
		$markup = '<span class="elementor-counter-number" data-to-value="2025" data-delimiter=",">2025</span>';
		$result = Digits::convert_in_markup( $markup, $this->arabic_indic_map() );

		$this->assertStringContainsString( 'data-to-value="2025"', $result, 'the frontend script re-reads this value' );
		$this->assertStringContainsString( '>٢٠٢٥<', $result );
	}

	public function test_markup_conversion_matches_additional_classes_and_single_quotes(): void {
		$markup = "<span class='before elementor-counter-number after'>7</span>";

		$this->assertSame(
			"<span class='before elementor-counter-number after'>٧</span>",
			Digits::convert_in_markup( $markup, $this->arabic_indic_map() )
		);
	}

	public function test_markup_conversion_only_touches_the_first_counter(): void {
		$markup = '<span class="elementor-counter-number">1</span><span class="elementor-counter-number">2</span>';

		$this->assertSame(
			'<span class="elementor-counter-number">١</span><span class="elementor-counter-number">2</span>',
			Digits::convert_in_markup( $markup, $this->arabic_indic_map() )
		);
	}

	public function test_markup_conversion_ignores_other_elements(): void {
		$markup = '<span class="elementor-counter-title">2025</span>';

		$this->assertSame( $markup, Digits::convert_in_markup( $markup, $this->arabic_indic_map() ) );
	}

	public function test_markup_is_unchanged_when_no_digit_set_is_configured(): void {
		$markup = '<span class="elementor-counter-number">2025</span>';

		$this->assertSame( $markup, Digits::convert_in_markup( $markup, [] ) );
	}

	public function test_counts_characters_not_bytes(): void {
		$this->assertSame( 1, Digits::character_length( '٠' ) );
		$this->assertSame( 1, Digits::character_length( 'a' ) );
		$this->assertSame( 0, Digits::character_length( '' ) );
		$this->assertSame( 3, Digits::character_length( 'abc' ) );
		$this->assertSame( 2, Digits::character_length( '٠١' ) );
	}
}
