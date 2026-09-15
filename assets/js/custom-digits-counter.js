/* global elementorFrontend */
(function () {
  "use strict";

  var SELECTOR = '.elementor-counter-number[data-custom-digits-counter="yes"]';
  var MAP_ATTRIBUTE = "data-custom-digits-counter-map";
  var DIGIT_COUNT = 10;

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

  function convertNativeCounter(numberEl) {
    if (
      "yes" !== numberEl.getAttribute("data-custom-digits-counter") ||
      numberEl.customDigitsCounterBound
    ) {
      return;
    }
    var digits = getDigits(numberEl);

    if (null === digits) {
      return;
    }

    numberEl.customDigitsCounterBound = true;

    var updateDigits = function () {
      var current = numberEl.textContent;
      var converted = convert(current, digits);

      if (current !== converted) {
        numberEl.textContent = converted;
      }
    };

    // Convert the resting value immediately, before the count-up animation runs.
    updateDigits();

    // Keep converting while Elementor's animation rewrites the text.
    new MutationObserver(updateDigits).observe(numberEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
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
