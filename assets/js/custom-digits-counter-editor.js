/* global customDigitsCounterEditor */
(function () {
  "use strict";

  var config = window.customDigitsCounterEditor || {};
  var SETTING = config.setting;
  var DIGIT_COUNT = config.count;
  var SEPARATOR = config.separator;
  var SELECTOR = 'textarea[data-setting="' + SETTING + '"]';
  var INVALID_CLASS = "custom-digits-counter-invalid";
  var observing = false;

  // Count code points, not UTF-16 units, so the result matches PHP's mb_strlen()
  // for characters outside the Basic Multilingual Plane.
  function characterLength(text) {
    return text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "_").length;
  }

  // Mirrors Digits::parse(). An empty field is "not configured",
  // not an error.
  function isValid(value) {
    if ("" === value.trim()) {
      return true;
    }

    var parts = value.split(SEPARATOR);

    if (parts.length !== DIGIT_COUNT) {
      return false;
    }

    for (var i = 0; i < parts.length; i++) {
      if (1 !== characterLength(parts[i].trim())) {
        return false;
      }
    }

    return true;
  }

  function validate(field) {
    if (!field) {
      return;
    }

    if (isValid(field.value)) {
      field.classList.remove(INVALID_CLASS);
    } else {
      field.classList.add(INVALID_CLASS);
    }
  }

  function scan(root) {
    var nodes = (root || document).querySelectorAll(SELECTOR);
    Array.prototype.forEach.call(nodes, validate);
  }

  function handleEvent(event) {
    var target = event.target;

    if (target && target.matches && target.matches(SELECTOR)) {
      validate(target);
    }
  }

  // The panel is re-rendered whenever a widget is selected, so the control has
  // to be re-validated as it reappears rather than only once at load.
  function observePanel() {
    if (observing || !document.body) {
      return;
    }
    observing = true;

    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;

        for (var j = 0; j < added.length; j++) {
          var node = added[j];

          if (1 !== node.nodeType) {
            continue;
          }

          if (node.matches && node.matches(SELECTOR)) {
            validate(node);
          } else if (node.querySelectorAll) {
            scan(node);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (!SETTING || !DIGIT_COUNT || !SEPARATOR) {
      return;
    }

    document.addEventListener("input", handleEvent);
    document.addEventListener("change", handleEvent);
    scan();
    observePanel();
  }

  if ("loading" === document.readyState) {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
