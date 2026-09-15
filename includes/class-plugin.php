<?php
/**
 * Native Counter integration for Elementor.
 *
 * @package CustomDigitsForElementorCounter
 */

namespace CustomDigitsForElementorCounter;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Main plugin singleton.
 *
 * Adds a "Custom Digits" control to Elementor's native Counter widget. When a
 * valid digit set is supplied, the counter's digits are substituted at the PHP
 * level during rendering, ensuring the initial HTML already uses them. The
 * frontend script applies the same set during count-up animations and for
 * late-rendered widgets (AJAX, popups, editor preview).
 */
final class Plugin {

	/**
	 * Data attribute injected into the counter number element.
	 *
	 * @var string
	 */
	const DATA_ATTRIBUTE = 'data-custom-digits-counter';

	/**
	 * Number of digits a custom digit set must define, one per decimal digit.
	 *
	 * @var int
	 */
	const CUSTOM_DIGITS_COUNT = 10;

	/**
	 * Data attribute carrying the custom digit set to the frontend script.
	 *
	 * @var string
	 */
	const MAP_ATTRIBUTE = self::DATA_ATTRIBUTE . '-map';

	/**
	 * Separator between digits in the "Custom Digits" control.
	 *
	 * @var string
	 */
	const CUSTOM_DIGITS_SEPARATOR = ',';

	/**
	 * Option storing the plugin version whose markup is currently cached.
	 *
	 * @var string
	 */
	const VERSION_OPTION = 'custom_digits_counter_rendered_version';

	/**
	 * Singleton instance.
	 *
	 * @var Plugin|null
	 */
	private static $instance = null;

	/**
	 * Retrieves the singleton instance, creating it on first call.
	 *
	 * @return Plugin
	 */
	public static function instance() {
		if ( is_null( self::$instance ) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Registers the Elementor control, render and asset hooks.
	 */
	private function __construct() {
		add_action( 'elementor/element/counter/section_counter/after_section_end', [ $this, 'add_controls' ] );
		add_action( 'elementor/widget/before_render_content', [ $this, 'add_render_attributes' ] );
		add_filter( 'elementor/widget/render_content', [ $this, 'add_frontend_data' ], 10, 2 );
		add_action( 'elementor/frontend/after_register_scripts', [ $this, 'register_assets' ] );
		add_action( 'elementor/frontend/after_enqueue_scripts', [ $this, 'enqueue_script' ] );
		add_action( 'elementor/editor/after_enqueue_scripts', [ $this, 'enqueue_editor_script' ] );
		add_action( 'elementor/editor/after_enqueue_styles', [ $this, 'enqueue_editor_style' ] );
		add_action( 'init', [ $this, 'maybe_flush_element_cache' ] );
	}

	/**
	 * Prevents cloning of the singleton.
	 */
	private function __clone() {}

	/**
	 * Prevents unserialization of the singleton.
	 *
	 * @throws \RuntimeException Always.
	 * @return void
	 */
	public function __wakeup() {
		throw new \RuntimeException( 'Plugin is a singleton and cannot be unserialized.' );
	}

	/**
	 * Clears Elementor's element cache after the plugin's markup changes.
	 *
	 * Elementor stores rendered widget markup in the `_elementor_element_cache`
	 * post meta and serves it without running `elementor/widget/render_content`,
	 * so a counter cached by an older build of this plugin keeps its old markup —
	 * Latin digits and no inline script — until the cache expires. Elementor only
	 * flushes on activation, deactivation, theme switch and the WP updater, which
	 * misses in-place file updates (git pull, rsync deploy, local development).
	 * Stamping the rendered version closes that gap.
	 *
	 * @return void
	 */
	public function maybe_flush_element_cache() {
		if ( CUSTOM_DIGITS_COUNTER_VERSION === get_option( self::VERSION_OPTION ) ) {
			return;
		}

		update_option( self::VERSION_OPTION, CUSTOM_DIGITS_COUNTER_VERSION );

		if ( isset( \Elementor\Plugin::$instance->files_manager ) ) {
			\Elementor\Plugin::$instance->files_manager->clear_cache();
		}
	}

	/**
	 * Adds the "Custom Digits" section to the native Counter widget.
	 *
	 * @param \Elementor\Widget_Base $widget Widget the controls are added to.
	 * @return void
	 */
	public function add_controls( $widget ) {
		if ( 'counter' !== $widget->get_name() ) {
			return;
		}

		$widget->start_controls_section(
			'custom_digits_counter_number_options',
			[
				'label' => esc_html__( 'Custom Digits', 'custom-digits-for-elementor-counter' ),
				'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
			]
		);

		$widget->add_control(
			'custom_digits_counter_custom_digits',
			[
				'label'       => esc_html__( 'Custom Digits', 'custom-digits-for-elementor-counter' ),
				'type'        => \Elementor\Controls_Manager::TEXTAREA,
				'default'     => '',
				'placeholder' => '٠,١,٢,٣,٤,٥,٦,٧,٨,٩',
				'description' => esc_html__( 'Exactly ten single characters separated by commas, in order from zero to nine. Spaces around each character are ignored. Any other format is ignored entirely.', 'custom-digits-for-elementor-counter' ),
			]
		);

		$widget->end_controls_section();
	}

	/**
	 * Flags the counter number element before Elementor renders the widget.
	 *
	 * Elementor's Counter widget builds its number element from the `counter`
	 * render attribute, so adding to that key here merges cleanly with the
	 * widget's own class and data attributes.
	 *
	 * @param \Elementor\Widget_Base $widget Widget about to be rendered.
	 * @return void
	 */
	public function add_render_attributes( $widget ) {
		if ( 'counter' !== $widget->get_name() ) {
			return;
		}

		$widget->add_render_attribute( 'counter', $this->get_render_attributes( $widget ) );
	}

	/**
	 * Flags the counter markup, converts digits server-side, and appends the inline script.
	 *
	 * The data attributes are only injected here as a fallback for when the
	 * `before_render_content` hook was unavailable; if they are already present
	 * that step is skipped. For Arabic counters, the digits are converted at the
	 * PHP level so the initial HTML contains Arabic-Indic numbers (no Latin flash).
	 * The inline script is still appended to handle digit conversion during the
	 * count-up animation.
	 *
	 * Every `preg_replace()` result is checked, so a PCRE failure (backtrack limit,
	 * invalid UTF-8) leaves the original markup intact rather than blanking it.
	 *
	 * @param string                 $content Rendered widget markup.
	 * @param \Elementor\Widget_Base $widget  Widget that produced the markup.
	 * @return string Markup, with data attributes converted digits and inline script.
	 */
	public function add_frontend_data( $content, $widget ) {
		if ( 'counter' !== $widget->get_name() ) {
			return $content;
		}

		if ( false === strpos( $content, self::DATA_ATTRIBUTE ) ) {

			$markup = '';

			foreach ( $this->get_render_attributes( $widget ) as $attribute => $value ) {
				$markup .= ' ' . $attribute . '="' . esc_attr( $value ) . '"';
			}

			$output = preg_replace(
				'/(<span\s+class=["\']elementor-counter-number["\'])/',
				'$1' . $markup,
				$content,
				1
			);

			if ( null === $output ) {
			} else {
				$content = $output;
			}
		} else {
		}

		// Convert counter digits server-side for Arabic format.
		return $this->convert_counter_digits( $content, $widget );
	}

	/**
	 * Applies the widget's custom digit set to the counter's rendered value.
	 *
	 * Runs server-side so the initial HTML already contains the custom digits,
	 * eliminating the Latin flash on first load.
	 *
	 * @param string                 $content Rendered widget markup.
	 * @param \Elementor\Widget_Base $widget  Widget that produced the markup.
	 * @return string Markup, with counter digits converted if format is Arabic.
	 */
	private function convert_counter_digits( $content, $widget ) {
		$digits = $this->get_custom_digits( $widget );

		if ( empty( $digits ) ) {
			return $content;
		}

		$output = preg_replace_callback(
			// Match the counter number span and capture its inner content.
			'/(<span[^>]*\sclass=(["\'])(?:[^"\']*\s)?elementor-counter-number(?:\s[^"\']*)?\2[^>]*>)([^<]*)(<\/span>)/',
			function ( $matches ) use ( $digits ) {
				// $matches[1] = opening span tag
				// $matches[3] = inner text (the number, possibly with separators)
				// $matches[4] = closing span tag
				return $matches[1] . $this->convert_with_digits( $matches[3], $digits ) . $matches[4];
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
	 * Replaces Latin digits in a string using a custom digit set.
	 *
	 * @param string   $text   Text containing Latin digits.
	 * @param string[] $digits Ten replacement characters indexed 0-9.
	 * @return string Text with each Latin digit swapped for its custom equivalent.
	 */
	private function convert_with_digits( $text, $digits ) {
		return str_replace( [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' ], $digits, $text );
	}

	/**
	 * Parses and validates the widget's "Custom Digits" value.
	 *
	 * The value is accepted only as exactly ten comma-separated single
	 * characters, ordered zero through nine. Anything else — too few or too many
	 * entries, an empty entry, or an entry longer than one character — is
	 * rejected as a whole rather than partially applied, so a malformed set can
	 * never produce a counter with some digits converted and others not.
	 *
	 * @param \Elementor\Widget_Base $widget Counter widget to read settings from.
	 * @return string[] Ten digit characters indexed 0-9, or an empty array if the value is unset or invalid.
	 */
	private function get_custom_digits( $widget ) {
		$settings = $widget->get_settings_for_display();

		return $this->parse_custom_digits( $settings['custom_digits_counter_custom_digits'] ?? '' );
	}

	/**
	 * Validates a raw "Custom Digits" string into a digit map.
	 *
	 * @param mixed $value Raw control value.
	 * @return string[] Ten digit characters indexed 0-9, or an empty array if invalid.
	 */
	private function parse_custom_digits( $value ) {
		if ( ! is_string( $value ) || '' === trim( $value ) ) {
			return [];
		}

		$parts = explode( self::CUSTOM_DIGITS_SEPARATOR, $value );

		if ( self::CUSTOM_DIGITS_COUNT !== count( $parts ) ) {
			return [];
		}

		$digits = [];

		foreach ( $parts as $part ) {
			$part = trim( $part );

			if ( 1 !== $this->character_length( $part ) ) {
				return [];
			}

			$digits[] = $part;
		}

		return $digits;
	}

	/**
	 * Counts characters in a UTF-8 string without requiring mbstring.
	 *
	 * @param string $text Text to measure.
	 * @return int Character count, or -1 if the text is not valid UTF-8.
	 */
	private function character_length( $text ) {
		if ( function_exists( 'mb_strlen' ) ) {
			return \mb_strlen( $text, 'UTF-8' );
		}

		$count = preg_match_all( '/./us', $text );

		return false === $count ? -1 : $count;
	}

	/**
	 * Resolves the widget's digit settings into the counter data attributes.
	 *
	 * A valid custom digit set is passed through as JSON so the frontend script
	 * applies the same set the server did.
	 *
	 * @param \Elementor\Widget_Base $widget Counter widget to read settings from.
	 * @return array<string,string> Attribute name/value pairs.
	 */
	private function get_render_attributes( $widget ) {
		$digits = $this->get_custom_digits( $widget );

		if ( empty( $digits ) ) {
			return [ self::DATA_ATTRIBUTE => 'no' ];
		}

		return [
			self::DATA_ATTRIBUTE => 'yes',
			self::MAP_ATTRIBUTE  => wp_json_encode( $digits ),
		];
	}

	/**
	 * Registers the frontend digit-conversion script.
	 *
	 * @return void
	 */
	public function register_assets() {
		wp_register_script(
			'custom-digits-counter',
			CUSTOM_DIGITS_COUNTER_PLUGIN_URL . 'assets/js/custom-digits-counter.js',
			[ 'elementor-frontend' ],
			CUSTOM_DIGITS_COUNTER_VERSION,
			true
		);
	}

	/**
	 * Enqueues the frontend digit-conversion script.
	 *
	 * @return void
	 */
	public function enqueue_script() {
		wp_enqueue_script( 'custom-digits-counter' );
	}

	/**
	 * Enqueues the editor script that flags an invalid "Custom Digits" value.
	 *
	 * The validation rules are handed to the script rather than restated in it,
	 * so the editor and `parse_custom_digits()` cannot drift apart.
	 *
	 * @return void
	 */
	public function enqueue_editor_script() {
		wp_enqueue_script(
			'custom-digits-counter-editor',
			CUSTOM_DIGITS_COUNTER_PLUGIN_URL . 'assets/js/custom-digits-counter-editor.js',
			[],
			CUSTOM_DIGITS_COUNTER_VERSION,
			true
		);

		wp_add_inline_script(
			'custom-digits-counter-editor',
			'window.customDigitsCounterEditor = ' . wp_json_encode(
				[
					'setting'   => 'custom_digits_counter_custom_digits',
					'count'     => self::CUSTOM_DIGITS_COUNT,
					'separator' => self::CUSTOM_DIGITS_SEPARATOR,
				]
			) . ';',
			'before'
		);
	}

	/**
	 * Enqueues the editor stylesheet holding the invalid-field state.
	 *
	 * @return void
	 */
	public function enqueue_editor_style() {
		wp_enqueue_style(
			'custom-digits-counter-editor',
			CUSTOM_DIGITS_COUNTER_PLUGIN_URL . 'assets/css/custom-digits-counter-editor.css',
			[],
			CUSTOM_DIGITS_COUNTER_VERSION
		);
	}
}
