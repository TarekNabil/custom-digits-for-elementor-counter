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
	const CUSTOM_DIGITS_COUNT = Digits::COUNT;

	/**
	 * Data attribute carrying the custom digit set to the frontend script.
	 *
	 * @var string
	 */
	const MAP_ATTRIBUTE = self::DATA_ATTRIBUTE . '-map';

	/**
	 * Data attribute carrying the digit set as typed, for TranslatePress to translate.
	 *
	 * @var string
	 */
	const SET_ATTRIBUTE = self::DATA_ATTRIBUTE . '-set';

	/**
	 * Node type TranslatePress records the digit set under.
	 *
	 * @var string
	 */
	const TRANSLATEPRESS_NODE_TYPE = 'custom_digits_counter_set';

	/**
	 * Separator between digits in the "Custom Digits" control.
	 *
	 * @var string
	 */
	const CUSTOM_DIGITS_SEPARATOR = Digits::SEPARATOR;

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
	 * Registers Elementor control, render and asset hooks, cache invalidation,
	 * and the WPML and TranslatePress integration filters.
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
		add_filter( 'wpml_elementor_widgets_to_translate', [ $this, 'register_wpml_field' ] );
		add_filter( 'trp_node_accessors', [ $this, 'register_translatepress_accessor' ] );
		add_filter( 'trp_allow_machine_translation_for_string', [ $this, 'skip_translatepress_machine_translation' ], 10, 3 );
		add_filter( 'trp_translateable_strings', [ $this, 'skip_translatepress_counter_value' ] );
		add_filter( 'trp_translateable_strings', [ $this, 'restore_translatepress_numeric_sets' ], 10, 6 );
		add_filter( 'trp_translated_html', [ $this, 'apply_translatepress_digits' ] );
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
				/* translators: Example shown in the empty field. Replace with the ten digits of your language's own numeral system, zero to nine, keeping the Latin comma (,) between them. If your language uses Latin digits, keep these. */
				'placeholder' => esc_attr__( '٠,١,٢,٣,٤,٥,٦,٧,٨,٩', 'custom-digits-for-elementor-counter' ),
				/* translators: Keep "(,)" as the Latin comma. It is the only separator the field accepts; a localized comma such as the Arabic comma (،) is rejected. */
				'description' => esc_html__( 'Exactly ten single characters in order from zero to nine, separated by commas (,). Spaces around each character are ignored. Any other format is ignored entirely.', 'custom-digits-for-elementor-counter' ),
			]
		);

		$widget->end_controls_section();
	}

	/**
	 * Exposes the "Custom Digits" field to WPML as its own translation box.
	 *
	 * Appended to WPML's existing Counter entry rather than declared in a
	 * wpml-config.xml: WPML merges config-file widgets over its defaults by
	 * widget name, so a `counter` entry there would drop the Title, Prefix and
	 * Suffix fields instead of adding to them. The label is passed unescaped
	 * because WPML escapes it where it is displayed.
	 *
	 * @param array $widgets Widgets WPML translates, keyed by widget name.
	 * @return array
	 */
	public function register_wpml_field( $widgets ) {
		if ( ! isset( $widgets['counter'] ) ) {
			$widgets['counter'] = [
				'conditions' => [ 'widgetType' => 'counter' ],
				'fields'     => [],
			];
		}

		$widgets['counter']['fields'][] = [
			'field'       => 'custom_digits_counter_custom_digits',
			/* translators: Label of the Custom Digits field in WPML's translation editor. */
			'type'        => __( 'Counter: Custom Digits', 'custom-digits-for-elementor-counter' ),
			'editor_type' => 'LINE',
		];

		return $widgets;
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
		return Digits::convert_in_markup( $content, $this->get_custom_digits( $widget ) );
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

		return Digits::parse( $settings['custom_digits_counter_custom_digits'] ?? '' );
	}

	/**
	 * Resolves the widget's digit settings into the counter data attributes.
	 *
	 * A valid custom digit set is passed through as JSON so the frontend script
	 * applies the same set the server did, and as a comma-separated string with
	 * whitespace around each digit removed for TranslatePress.
	 * The TranslatePress attributes are emitted whether or not it is active:
	 * Elementor caches rendered widget markup, so a counter cached before
	 * TranslatePress was activated would otherwise never become translatable.
	 *
	 * @param \Elementor\Widget_Base $widget Counter widget to read settings from.
	 * @return array<string,string> Attribute name/value pairs, or only the disabled
	 *                             flag when the digit setting is empty or invalid.
	 */
	private function get_render_attributes( $widget ) {
		$digits = $this->get_custom_digits( $widget );

		if ( empty( $digits ) ) {
			return [ self::DATA_ATTRIBUTE => 'no' ];
		}

		return [
			self::DATA_ATTRIBUTE          => 'yes',
			self::MAP_ATTRIBUTE           => wp_json_encode( $digits ),
			self::SET_ATTRIBUTE           => implode( self::CUSTOM_DIGITS_SEPARATOR, $digits ),
			// The count-up rewrites the value every frame; TranslatePress would
			// otherwise look each frame up as a new string.
			'data-no-dynamic-translation' => '',
			// Keeps in-browser translators such as GTranslate's Google widget off
			// the value, which the frontend script owns.
			'translate'                   => 'no',
		];
	}

	/**
	 * Lets TranslatePress translate a counter's digit set like any other string.
	 *
	 * TranslatePress translates the rendered page, so the set travels on the
	 * counter number as an attribute it is told to translate, which also puts
	 * its edit pencil on the counter itself. TranslatePress keys translations by
	 * the original string, so counters sharing an original set share a
	 * translation.
	 *
	 * @param array $accessors Attributes TranslatePress translates, keyed by type.
	 * @return array
	 */
	public function register_translatepress_accessor( $accessors ) {
		$accessors[ self::TRANSLATEPRESS_NODE_TYPE ] = [
			'selector'  => '[' . self::SET_ATTRIBUTE . ']',
			'accessor'  => self::SET_ATTRIBUTE,
			'attribute' => true,
		];

		return $accessors;
	}

	/**
	 * Keeps TranslatePress's machine translation away from digit sets.
	 *
	 * A translation engine may swap the comma for a localized one such as the
	 * Arabic comma, which the parser rejects, leaving the counter in its
	 * original digits.
	 *
	 * @param bool        $allow    Whether the string may be machine translated.
	 * @param string      $string   The string, entity-decoded.
	 * @param string|null $accessor Attribute the string was read from, if any.
	 * @return bool
	 */
	public function skip_translatepress_machine_translation( $allow, $string, $accessor = null ) {
		return self::SET_ATTRIBUTE === $accessor ? false : $allow;
	}

	/**
	 * Drops the counter's rendered value from the strings TranslatePress lists.
	 *
	 * The count-up rewrites that value on every frame, so a translation of it
	 * would never be seen. Latin digits are skipped by TranslatePress as numeric
	 * already; a value in any other set would otherwise be offered for
	 * translation next to the digit set.
	 *
	 * @param array $information Parallel `translateable_strings` and `nodes` lists.
	 * @return array
	 */
	public function skip_translatepress_counter_value( $information ) {
		if ( empty( $information['nodes'] ) || ! is_array( $information['nodes'] ) ) {
			return $information;
		}

		foreach ( $information['nodes'] as $index => $node ) {
			$parent = isset( $node['node'] ) && is_object( $node['node'] ) ? $node['node']->parent() : null;

			if ( 'text' === ( $node['type'] ?? '' ) && $parent && isset( $parent->{self::SET_ATTRIBUTE} ) ) {
				unset( $information['nodes'][ $index ], $information['translateable_strings'][ $index ] );
			}
		}

		$information['nodes']                 = array_values( $information['nodes'] );
		$information['translateable_strings'] = array_values( (array) $information['translateable_strings'] );

		return $information;
	}

	/**
	 * Adds back digit sets TranslatePress discarded as numbers.
	 *
	 * TranslatePress trims a string made only of Latin digits and punctuation to
	 * nothing unless its "translate numbers" setting is on, so a counter whose
	 * original set is `0,1,2,3,4,5,6,7,8,9` would never be offered. Any valid set
	 * on an element not already listed is added back, including non-Latin sets.
	 * Translation opt-outs and translation blocks are respected when the renderer
	 * provides the corresponding ancestor checks.
	 *
	 * @param array       $information            Parallel `translateable_strings` and `nodes` lists.
	 * @param object      $html                   Parsed page, as TranslatePress's HTML DOM.
	 * @param string      $no_translate_attribute Attribute that opts an element out of translation.
	 * @param string      $language               Language being rendered.
	 * @param string      $language_code          Language being rendered, as a code.
	 * @param object|null $render                 Renderer used to check translation exclusions, if available.
	 * @return array
	 */
	public function restore_translatepress_numeric_sets( $information, $html, $no_translate_attribute = 'data-no-translation', $language = '', $language_code = '', $render = null ) {
		if ( ! is_array( $information ) || ! is_object( $html ) || ! method_exists( $html, 'find' ) ) {
			return $information;
		}

		$listed = [];

		foreach ( (array) ( $information['nodes'] ?? [] ) as $node ) {
			if ( self::TRANSLATEPRESS_NODE_TYPE === ( $node['type'] ?? '' ) && is_object( $node['node'] ?? null ) ) {
				$listed[ spl_object_id( $node['node'] ) ] = true;
			}
		}

		/** Returns whether available renderer checks exclude the element from translation. */
		$opted_out = function ( $element ) use ( $render, $no_translate_attribute ) {
			if ( ! is_object( $render ) ) {
				return false;
			}

			return ( method_exists( $render, 'has_ancestor_attribute' )
					&& ( $render->has_ancestor_attribute( $element, $no_translate_attribute )
						|| $render->has_ancestor_attribute( $element, $no_translate_attribute . '-' . self::SET_ATTRIBUTE ) ) )
				|| ( method_exists( $render, 'has_ancestor_class' ) && $render->has_ancestor_class( $element, 'translation-block' ) );
		};

		foreach ( $html->find( '[' . self::SET_ATTRIBUTE . ']' ) as $element ) {
			$set = html_entity_decode( trim( (string) $element->getAttribute( self::SET_ATTRIBUTE ) ), ENT_QUOTES, 'UTF-8' );

			if ( isset( $listed[ spl_object_id( $element ) ] ) || empty( Digits::parse( $set ) ) || $opted_out( $element ) ) {
				continue;
			}

			$information['translateable_strings'][] = $set;
			$information['nodes'][]                 = [
				'node' => $element,
				'type' => self::TRANSLATEPRESS_NODE_TYPE,
			];
		}

		return $information;
	}

	/**
	 * Applies each counter's translated digit set to the translated page.
	 *
	 * Runs after TranslatePress has rewritten the set attribute, so the first
	 * paint already uses the translated digits and the map handed to the
	 * frontend script animates in them too. A translation that is not a valid
	 * set leaves the counter in its original digits. A missing or non-array
	 * original map also leaves the counter unchanged. A regex failure preserves
	 * the affected counter, or the whole input if the outer replacement fails.
	 *
	 * @param string $html Page markup as translated by TranslatePress.
	 * @return string
	 */
	public function apply_translatepress_digits( $html ) {
		if ( ! is_string( $html ) || false === strpos( $html, self::SET_ATTRIBUTE ) ) {
			return $html;
		}

		$output = preg_replace_callback(
			Digits::COUNTER_NUMBER_PATTERN,
			function ( $matches ) {
				$tag        = $matches[1];
				$translated = Digits::parse( $this->get_tag_attribute( $tag, self::SET_ATTRIBUTE ) );
				$original   = json_decode( $this->get_tag_attribute( $tag, self::MAP_ATTRIBUTE ), true );

				if ( empty( $translated ) || ! is_array( $original ) || $translated === $original ) {
					return $matches[0];
				}

				$map = esc_attr( wp_json_encode( $translated ) );
				$tag = preg_replace_callback(
					'/(\s' . preg_quote( self::MAP_ATTRIBUTE, '/' ) . '=)(["\'])(.*?)\2/s',
					function ( $attribute ) use ( $map ) {
						return $attribute[1] . '"' . $map . '"';
					},
					$tag,
					1
				);

				if ( null === $tag ) {
					return $matches[0];
				}

				return $tag . Digits::replace_set( $matches[3], $original, $translated ) . $matches[4];
			},
			$html
		);

		return null === $output ? $html : $output;
	}

	/**
	 * Reads one quoted attribute's decoded value from an opening HTML tag.
	 * The name and equals sign must be adjacent, followed immediately by a quote.
	 *
	 * @param string $tag       Opening tag markup.
	 * @param string $attribute Attribute name.
	 * @return string Decoded value, or an empty string if no attribute matches or
	 *                the regex fails.
	 */
	private function get_tag_attribute( $tag, $attribute ) {
		if ( ! preg_match( '/\s' . preg_quote( $attribute, '/' ) . '=(["\'])(.*?)\1/s', $tag, $matches ) ) {
			return '';
		}

		return html_entity_decode( $matches[2], ENT_QUOTES, 'UTF-8' );
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
	 * so the editor and `Digits::parse()` cannot drift apart.
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
