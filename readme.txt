=== Custom Digits for Elementor Counter ===
Contributors: tareknabil
Tags: elementor, counter, arabic, numerals, rtl
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Display Elementor's native Counter widget in any numeral system by supplying your own set of ten digit characters.

== Description ==

Elementor's Counter widget always counts in Latin numerals — 1, 2, 3. This plugin adds a **Custom Digits** field to that widget so you can supply your own ten characters and have the counter display and animate with those instead.

It does not add a new widget. It extends the Counter widget you already use, so your existing layout, styling and animation settings are untouched.

= Use your own numerals =

Enter ten comma-separated characters, in order from zero to nine:

* Arabic-Indic — `٠,١,٢,٣,٤,٥,٦,٧,٨,٩`
* Eastern Arabic-Indic — `۰,۱,۲,۳,۴,۵,۶,۷,۸,۹`
* Devanagari — `०,१,२,३,४,५,६,७,८,९`
* Bengali — `০,১,২,৩,৪,৫,৬,৭,৮,৯`
* Or any ten characters you like

= No flash of Latin digits =

The substitution happens in PHP while the page is rendered, so the counter's very first paint already shows your characters. Visitors never see Latin numerals flick over to something else on load.

= The animation is converted too =

Elementor rewrites the counter's text on every frame of its count-up animation. This plugin watches the element and re-applies your digit set as those frames run, so the counter stays in your numeral system for the whole count, not just at the final value.

= Validation while you type =

The field accepts exactly ten single characters separated by commas. Anything else — too few entries, too many, or an entry longer than one character — is rejected as a whole rather than half-applied. The field is outlined in red in the editor the moment the value stops being valid, and the same rule is enforced again on the server when the page renders.

= Safe by default =

Leave the field empty and nothing changes. Counters render exactly as Elementor renders them, and no conversion code runs.

== Installation ==

1. Install and activate [Elementor](https://wordpress.org/plugins/elementor/). This plugin does nothing without it and will show a notice if it is missing.
2. Upload the plugin through **Plugins > Add New > Upload Plugin**, or install it from the WordPress.org directory.
3. Activate **Custom Digits for Elementor Counter** through the **Plugins** screen.
4. Edit any page with Elementor, select a **Counter** widget, and open the **Custom Digits** section in the Content tab.

== Frequently Asked Questions ==

= Does this add a new widget? =

No. It adds a control to Elementor's existing Counter widget. Your current counters keep their settings, and you opt in per widget by filling in the Custom Digits field.

= Do I need Elementor Pro? =

No. The Counter widget is part of the free Elementor plugin, and that is all this plugin needs.

= Which numeral systems are supported? =

Any of them. The plugin does not ship a fixed list — you type the ten characters you want, so Arabic-Indic, Eastern Arabic-Indic, Devanagari, Bengali, Thai, Burmese and anything else all work the same way.

= Can I use characters that are not numbers? =

Yes. The field takes any ten single characters, including letters and symbols. Each one simply replaces the Latin digit at the same position.

= Why is the field outlined in red? =

The value is not exactly ten single characters separated by commas. Check that you have ten entries, that each is one character, and that you have not left a trailing comma. Spaces around each character are ignored, so `٠, ١, ٢` is fine.

= What happens if the value is invalid? =

Nothing is converted. The counter renders with its normal Latin digits rather than applying a partial or broken digit set.

= Does the thousands separator still work? =

Yes. Only the digits themselves are replaced, so separators, prefixes and suffixes configured on the Counter widget are left exactly as they are.

= What happens to my counters if I deactivate the plugin? =

They revert to Latin digits. Nothing else changes — the plugin does not modify your page content, only the markup produced when a counter is rendered.

= My counter still shows the old digits after I changed them. =

Elementor caches rendered widget markup. Saving the page in the editor clears that cache for the page. The plugin also clears Elementor's cache automatically whenever its own version changes.

== Screenshots ==

1. The Custom Digits field in the Counter widget's Content tab.
2. An invalid value outlined in red as it is typed.
3. A counter rendered with Arabic-Indic digits on the frontend.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
