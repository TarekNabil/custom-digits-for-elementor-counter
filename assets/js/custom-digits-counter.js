/* global elementorFrontend */
(function () {
  "use strict";

  var SELECTOR = '.elementor-counter-number[data-custom-digits-counter="yes"]';
  var MAP_ATTRIBUTE = "data-custom-digits-counter-map";
  var DIGIT_COUNT = 10;
  var SEPARATOR = ",";
  var CHARACTER = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g;

  // One per bound counter, run when the page's language changes.
  var languageListeners = [];
  var watchingLanguage = false;

  // Returns the element's digit set, or null when it carries none usable.
  function getDigits(numberEl) {
    var raw = numberEl.getAttribute(MAP_ATTRIBUTE);

    if (!raw) {
      return null;
    }

    try {
      var parsed = JSON.parse(raw);

      if (
        Object.prototype.toString.call(parsed) === "[object Array]" &&
        DIGIT_COUNT === parsed.length
      ) {
        return parsed;
      }
    } catch (error) {
      // Nothing usable; leave the counter alone.
    }

    return null;
  }

  function convert(str, digits) {
    return str.replace(/[0-9]/g, function (digit) {
      return digits[parseInt(digit, 10)];
    });
  }

  /**
   * Rewrites text between digit sets in one pass, leaving other characters alone.
   *
   * @param {string} str Text written in the source set.
   * @param {string[]} from Source characters indexed 0-9; the first match wins.
   * @param {string[]} to Replacement characters at the corresponding indexes.
   * @returns {string} Text with source characters replaced, without reprocessing replacements.
   */
  function replaceSet(str, from, to) {
    return str.replace(CHARACTER, function (character) {
      var index = from.indexOf(character);
      return -1 === index ? character : to[index];
    });
  }

  /** Returns whether the entries at indexes 0-9 match in both digit sets. */
  function sameSet(a, b) {
    for (var i = 0; i < DIGIT_COUNT; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Parses a digit set typed outside the plugin's own field.
   *
   * Requires exactly ten comma-separated entries, each a single character after
   * trimming whitespace. A UTF-16 surrogate pair counts as one character.
   *
   * @returns {string[]|null} Characters indexed 0-9, or null for a non-string or invalid set.
   */
  function parseSet(value) {
    if ("string" !== typeof value) {
      return null;
    }

    var parts = value.split(SEPARATOR);

    if (DIGIT_COUNT !== parts.length) {
      return null;
    }

    var digits = [];

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      var characters = part.match(CHARACTER);

      if (!characters || 1 !== characters.length) {
        return null;
      }

      digits.push(part);
    }

    return digits;
  }

  /**
   * Finds a GTranslate Visual Addon digit set for the current <html lang>.
   *
   * Matches saved original text against the counter's original set after parsing
   * both sides of each translation pair, ignoring invalid pairs.
   *
   * @param {string[]} digits The counter's original characters indexed 0-9.
   * @returns {string[]|null} First valid matching translation, or null if none is available.
   */
  function getTranslatedDigits(digits) {
    var settings = window.gtAddonSettings;
    var pairs =
      settings &&
      settings.translations &&
      settings.translations[document.documentElement.lang];

    if (!pairs || "object" !== typeof pairs) {
      return null;
    }

    for (var original in pairs) {
      if (Object.prototype.hasOwnProperty.call(pairs, original)) {
        var from = parseSet(original);
        var to = from && sameSet(from, digits) ? parseSet(pairs[original]) : null;

        if (to) {
          return to;
        }
      }
    }

    return null;
  }

  /**
   * Notifies bound counters when <html lang> changes using one shared observer.
   * Does nothing if already watching or MutationObserver is unavailable.
   */
  function watchLanguage() {
    if (watchingLanguage || "function" !== typeof MutationObserver) {
      return;
    }
    watchingLanguage = true;

    new MutationObserver(function () {
      for (var i = 0; i < languageListeners.length; i++) {
        languageListeners[i]();
      }
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }

  /**
   * Converts a counter immediately and keeps it updated during animation and
   * language changes. Missing or invalid translations restore its original set.
   * Skips counters already bound, not enabled, or without a ten-entry digit map.
   *
   * @param {Element} numberEl Counter number element whose text will be rewritten.
   * @throws {ReferenceError} If MutationObserver is not defined when binding the counter.
   */
  function convertNativeCounter(numberEl) {
    if (
      "yes" !== numberEl.getAttribute("data-custom-digits-counter") ||
      numberEl.customDigitsCounterBound
    ) {
      return;
    }
    var original = getDigits(numberEl);

    if (null === original) {
      return;
    }

    numberEl.customDigitsCounterBound = true;

    // The set the text is written in: the server renders the resting value in
    // the original set.
    var applied = original;
    var observer = null;

    // A set that reuses Latin digits in other positions makes the plugin's own
    // output look like a new animation frame, so the records a write produces
    // are dropped rather than converted again.
    var write = function (text) {
      numberEl.textContent = text;

      if (observer) {
        observer.takeRecords();
      }
    };

    /** Replaces Latin digits in the counter's text using the currently applied set. */
    var updateDigits = function () {
      var current = numberEl.textContent;
      var converted = convert(current, applied);

      if (current !== converted) {
        write(converted);
      }
    };

    /** Rewrites the current text into the translated set, or the original as a fallback. */
    var updateLanguage = function () {
      var next = getTranslatedDigits(original) || original;

      if (sameSet(next, applied)) {
        return;
      }

      // A frame Elementor wrote that the observer has not converted yet is
      // still Latin; convert it first so the rewrite starts from the applied set.
      if (observer && observer.takeRecords().length) {
        updateDigits();
      }

      var current = numberEl.textContent;
      var rewritten = replaceSet(current, applied, next);

      applied = next;

      if (current !== rewritten) {
        write(rewritten);
      }
    };

    // Convert the resting value immediately, before the count-up animation runs.
    updateLanguage();
    updateDigits();

    // Keep converting while Elementor's animation rewrites the text.
    observer = new MutationObserver(updateDigits);
    observer.observe(numberEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    languageListeners.push(updateLanguage);
    watchLanguage();
  }

  function scan(root) {
    var nodes = (root || document).querySelectorAll(SELECTOR);
    Array.prototype.forEach.call(nodes, convertNativeCounter);
  }

  // Scan for counters and bind mutation observers to handle animations.
  scan();

  if ("loading" === document.readyState) {
    document.addEventListener("DOMContentLoaded", function () {
      scan();
    });
  }

  window.addEventListener("load", function () {
    scan();
  });

  // Handle counters rendered later (popups, AJAX, editor preview) via Elementor's hook.
  function registerHooks() {
    if (!window.elementorFrontend || !elementorFrontend.hooks) {
      return;
    }

    elementorFrontend.hooks.addAction(
      "frontend/element_ready/counter.default",
      function ($scope) {
        scan($scope[0]);
      },
    );
  }

  registerHooks();
  window.addEventListener("elementor/frontend/init", registerHooks);
})();
