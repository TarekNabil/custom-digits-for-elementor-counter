/**
 * Tests for the frontend counter conversion.
 *
 * PHP converts the resting value before the markup is sent, so this script's job
 * is to keep the digits converted while Elementor's count-up animation rewrites
 * the text, and to catch counters rendered after page load.
 */

const SCRIPT = "../../assets/js/custom-digits-counter.js";
const FLAG_ATTRIBUTE = "data-custom-digits-counter";
const MAP_ATTRIBUTE = "data-custom-digits-counter-map";
const ARABIC_INDIC = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function loadScript() {
  jest.resetModules();
  require(SCRIPT);
}

/** Builds a counter number element as the PHP render attributes leave it. */
function addCounter(text, { flag = "yes", map = ARABIC_INDIC } = {}) {
  const el = document.createElement("span");
  el.className = "elementor-counter-number";
  if (null !== flag) {
    el.setAttribute(FLAG_ATTRIBUTE, flag);
  }
  if (null !== map) {
    el.setAttribute(MAP_ATTRIBUTE, typeof map === "string" ? map : JSON.stringify(map));
  }
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

/** Lets pending MutationObserver callbacks run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  document.body.innerHTML = "";
  document.documentElement.lang = "en";
  delete window.elementorFrontend;
  delete window.gtAddonSettings;
});

describe("initial conversion", () => {
  test("converts the resting value on load", () => {
    const el = addCounter("2025");
    loadScript();
    expect(el.textContent).toBe("٢٠٢٥");
  });

  test("preserves thousands separators and other characters", () => {
    const el = addCounter("1,234.5+");
    loadScript();
    expect(el.textContent).toBe("١,٢٣٤.٥+");
  });

  test("converts every counter on the page", () => {
    const first = addCounter("1");
    const second = addCounter("2");
    loadScript();
    expect([first.textContent, second.textContent]).toEqual(["١", "٢"]);
  });
});

describe("counters it must leave alone", () => {
  test.each([
    ["the flag attribute is absent", { flag: null }],
    ["the flag is not yes", { flag: "no" }],
    ["the digit map is absent", { map: null }],
    ["the digit map is not valid JSON", { map: "{not json" }],
    ["the digit map has too few entries", { map: ["٠", "١"] }],
    ["the digit map is not an array", { map: { 0: "٠" } }],
  ])("ignores a counter when %s", (_label, options) => {
    const el = addCounter("2025", options);
    loadScript();
    expect(el.textContent).toBe("2025");
  });
});

describe("during the count-up animation", () => {
  test("re-converts when Elementor rewrites the text", async () => {
    const el = addCounter("0");
    loadScript();
    expect(el.textContent).toBe("٠");

    el.textContent = "500";
    await flush();
    expect(el.textContent).toBe("٥٠٠");

    el.textContent = "1000";
    await flush();
    expect(el.textContent).toBe("١٠٠٠");
  });

  test("re-converts when the existing text node is updated in place", async () => {
    // Writing to textContent replaces the node (a childList mutation), so this
    // covers the characterData path separately: a caller mutating the existing
    // text node must still be caught.
    const el = addCounter("1");
    loadScript();

    el.firstChild.nodeValue = "300";
    await flush();
    expect(el.textContent).toBe("٣٠٠");
  });

  test("leaves already-converted text untouched", async () => {
    const el = addCounter("7");
    loadScript();

    el.textContent = "٧";
    await flush();
    expect(el.textContent).toBe("٧");
  });

  // A set reusing Latin digits in other positions turns the plugin's own output
  // back into "Latin" input; converting that echo would undo the frame, and the
  // undo would be converted again, endlessly.
  test("does not re-convert its own output for a Latin-digit permutation", async () => {
    const el = addCounter("0", { map: ["9", "8", "7", "6", "5", "4", "3", "2", "1", "0"] });
    loadScript();

    el.textContent = "12";
    await flush();
    await flush();
    expect(el.textContent).toBe("87");
  }, 1000);

  test("binds only one observer per element across repeated scans", async () => {
    const el = addCounter("1");
    loadScript();

    window.dispatchEvent(new window.Event("load"));
    await flush();

    el.textContent = "42";
    await flush();
    expect(el.textContent).toBe("٤٢");
  });
});

describe("GTranslate Visual Addon overrides", () => {
  const LATIN = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const DEVANAGARI = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

  /** Saves pairs the way the addon hands them to the browser. */
  function saveAddonPairs(lang, pairs) {
    window.gtAddonSettings = { translations: { [lang]: pairs }, containers: [] };
  }

  /** Switches <html lang> as GTranslate's widget does once it has translated. */
  async function switchLanguage(lang) {
    document.documentElement.lang = lang;
    await flush();
  }

  test("rewrites the value when the page switches to a language with a saved set", async () => {
    saveAddonPairs("ar", { "0,1,2,3,4,5,6,7,8,9": ARABIC_INDIC.join(",") });
    const el = addCounter("100", { map: LATIN });
    loadScript();
    expect(el.textContent).toBe("100");

    await switchLanguage("ar");
    expect(el.textContent).toBe("١٠٠");
  });

  test("animates in the saved set after the switch", async () => {
    saveAddonPairs("ar", { "0,1,2,3,4,5,6,7,8,9": ARABIC_INDIC.join(",") });
    const el = addCounter("0", { map: LATIN });
    loadScript();
    await switchLanguage("ar");

    el.textContent = "57";
    await flush();
    expect(el.textContent).toBe("٥٧");
  });

  test("rewrites from a non-Latin original set", async () => {
    saveAddonPairs("hi", { [ARABIC_INDIC.join(",")]: DEVANAGARI.join(",") });
    const el = addCounter("100");
    loadScript();
    expect(el.textContent).toBe("١٠٠");

    await switchLanguage("hi");
    expect(el.textContent).toBe("१००");
  });

  test("does not convert its language rewrite back for a Latin-digit permutation", async () => {
    saveAddonPairs("ar", { "0,1,2,3,4,5,6,7,8,9": "9,8,7,6,5,4,3,2,1,0" });
    const el = addCounter("12", { map: LATIN });
    loadScript();

    await switchLanguage("ar");
    await flush();
    expect(el.textContent).toBe("87");

    el.textContent = "34";
    await flush();
    await flush();
    expect(el.textContent).toBe("65");
  }, 1000);

  test("converts a frame still waiting for the observer before rewriting", async () => {
    const reversed = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "0"];
    saveAddonPairs("ar", { [reversed.join(",")]: ARABIC_INDIC.join(",") });
    addCounter("1", { map: reversed }); // Starts the language watcher.
    loadScript();

    // Bound after the watcher, so the watcher's callback runs first and finds
    // Elementor's frame still in Latin digits.
    const el = addCounter("0", { map: reversed });
    window.dispatchEvent(new window.Event("load"));

    el.textContent = "34";
    document.documentElement.lang = "ar";
    await flush();
    await flush();
    expect(el.textContent).toBe("٣٤");
  }, 1000);

  test("applies the saved set when the page is already in that language", () => {
    saveAddonPairs("ar", { "0,1,2,3,4,5,6,7,8,9": ARABIC_INDIC.join(",") });
    document.documentElement.lang = "ar";
    const el = addCounter("42", { map: LATIN });
    loadScript();

    expect(el.textContent).toBe("٤٢");
  });

  test("matches an original typed with spaces around the digits", async () => {
    saveAddonPairs("ar", { "0, 1, 2, 3, 4, 5, 6, 7, 8, 9": ARABIC_INDIC.join(", ") });
    const el = addCounter("9", { map: LATIN });
    loadScript();

    await switchLanguage("ar");
    expect(el.textContent).toBe("٩");
  });

  test("returns to the original set when the page switches back", async () => {
    saveAddonPairs("ar", { "0,1,2,3,4,5,6,7,8,9": ARABIC_INDIC.join(",") });
    const el = addCounter("12", { map: LATIN });
    loadScript();
    await switchLanguage("ar");

    await switchLanguage("en");
    expect(el.textContent).toBe("12");
  });

  test.each([
    ["no pair is saved for the counter's set", { "q,w,e,r,t,y,u,i,o,p": ARABIC_INDIC.join(",") }],
    ["the saved set uses the Arabic comma", { "0,1,2,3,4,5,6,7,8,9": ARABIC_INDIC.join("،") }],
    ["the saved set has too few entries", { "0,1,2,3,4,5,6,7,8,9": "٠,١,٢" }],
  ])("keeps the original set when %s", async (_label, pairs) => {
    saveAddonPairs("ar", pairs);
    const el = addCounter("2025", { map: LATIN });
    loadScript();

    await switchLanguage("ar");
    expect(el.textContent).toBe("2025");
  });

  test("keeps the original set when the addon is not installed", async () => {
    const el = addCounter("2025");
    loadScript();

    await switchLanguage("ar");
    expect(el.textContent).toBe("٢٠٢٥");
  });
});

describe("late-rendered counters", () => {
  test("registers an Elementor hook when the frontend API is present", () => {
    const addAction = jest.fn();
    window.elementorFrontend = { hooks: { addAction } };
    loadScript();

    expect(addAction).toHaveBeenCalledWith(
      "frontend/element_ready/counter.default",
      expect.any(Function),
    );
  });

  test("converts a counter delivered through the Elementor hook", () => {
    const addAction = jest.fn();
    window.elementorFrontend = { hooks: { addAction } };
    loadScript();

    const scope = document.createElement("div");
    const el = document.createElement("span");
    el.className = "elementor-counter-number";
    el.setAttribute(FLAG_ATTRIBUTE, "yes");
    el.setAttribute(MAP_ATTRIBUTE, JSON.stringify(ARABIC_INDIC));
    el.textContent = "88";
    scope.appendChild(el);

    // Elementor passes a jQuery object; only [0] is used.
    addAction.mock.calls[0][1]([scope]);

    expect(el.textContent).toBe("٨٨");
  });

  test("registers hooks when Elementor initialises after the script", () => {
    loadScript();

    const addAction = jest.fn();
    window.elementorFrontend = { hooks: { addAction } };
    window.dispatchEvent(new window.Event("elementor/frontend/init"));

    expect(addAction).toHaveBeenCalledWith(
      "frontend/element_ready/counter.default",
      expect.any(Function),
    );
  });

  test("does not throw when Elementor is absent", () => {
    expect(() => loadScript()).not.toThrow();
  });

  test("converts counters added to the page after load", () => {
    loadScript();

    const el = addCounter("9");
    window.dispatchEvent(new window.Event("load"));

    expect(el.textContent).toBe("٩");
  });
});
