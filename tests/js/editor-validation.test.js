/**
 * Tests for the editor control's live validation.
 *
 * These mirror the PHP rules in Digits::parse(): the editor marks a field
 * invalid exactly when PHP would reject the value and ignore it, so the two
 * implementations are held to the same contract here.
 */

const SCRIPT = "../../assets/js/custom-digits-counter-editor.js";
const SETTING = "custom_digits_counter_custom_digits";
const INVALID_CLASS = "custom-digits-counter-invalid";
const ARABIC_INDIC = "٠,١,٢,٣,٤,٥,٦,٧,٨,٩";

/** Loads the script fresh against the current document. */
function loadScript() {
  jest.resetModules();
  require(SCRIPT);
}

/** Creates the control's textarea, as Elementor renders it. */
function addField(value = "") {
  const field = document.createElement("textarea");
  field.setAttribute("data-setting", SETTING);
  field.value = value;
  document.body.appendChild(field);
  return field;
}

/** Fires the event Elementor's panel fires as the user types. */
function type(field, value) {
  field.value = value;
  field.dispatchEvent(new window.Event("input", { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.customDigitsCounterEditor = {
    setting: SETTING,
    count: 10,
    separator: ",",
  };
});

describe("validation on existing fields", () => {
  test.each([
    ["a valid Arabic-Indic set", ARABIC_INDIC],
    ["a Latin set", "0,1,2,3,4,5,6,7,8,9"],
    ["whitespace around each digit", " ٠ , ١ ,٢,٣,٤,٥,٦,٧,٨, ٩ "],
    ["an empty field (not yet configured)", ""],
    ["a whitespace-only field", "   "],
    ["Devanagari digits", "०,१,२,३,४,५,६,७,८,९"],
  ])("accepts %s", (_label, value) => {
    const field = addField(value);
    loadScript();
    expect(field.classList.contains(INVALID_CLASS)).toBe(false);
  });

  test.each([
    ["nine digits", "٠,١,٢,٣,٤,٥,٦,٧,٨"],
    ["eleven digits", "٠,١,٢,٣,٤,٥,٦,٧,٨,٩,١٠"],
    ["no separators", "٠١٢٣٤٥٦٧٨٩"],
    ["a two-character entry", "٠٠,١,٢,٣,٤,٥,٦,٧,٨,٩"],
    ["an empty entry", "٠,,٢,٣,٤,٥,٦,٧,٨,٩"],
    ["a trailing separator", "٠,١,٢,٣,٤,٥,٦,٧,٨,٩,"],
    ["the wrong separator", "٠;١;٢;٣;٤;٥;٦;٧;٨;٩"],
  ])("rejects %s", (_label, value) => {
    const field = addField(value);
    loadScript();
    expect(field.classList.contains(INVALID_CLASS)).toBe(true);
  });
});

describe("validation while typing", () => {
  test("flags a field as it becomes invalid", () => {
    const field = addField(ARABIC_INDIC);
    loadScript();
    expect(field.classList.contains(INVALID_CLASS)).toBe(false);

    type(field, "٠,١");
    expect(field.classList.contains(INVALID_CLASS)).toBe(true);
  });

  test("clears the flag once the value becomes valid again", () => {
    const field = addField("bad");
    loadScript();
    expect(field.classList.contains(INVALID_CLASS)).toBe(true);

    type(field, ARABIC_INDIC);
    expect(field.classList.contains(INVALID_CLASS)).toBe(false);
  });

  test("responds to change as well as input", () => {
    const field = addField(ARABIC_INDIC);
    loadScript();

    field.value = "nope";
    field.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(field.classList.contains(INVALID_CLASS)).toBe(true);
  });

  test("ignores events from unrelated fields", () => {
    const other = document.createElement("textarea");
    other.setAttribute("data-setting", "some_other_control");
    document.body.appendChild(other);
    loadScript();

    type(other, "clearly not ten digits");
    expect(other.classList.contains(INVALID_CLASS)).toBe(false);
  });
});

describe("panel re-rendering", () => {
  test("validates a control added to the panel after load", async () => {
    loadScript();

    const field = addField("only,three,entries");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(field.classList.contains(INVALID_CLASS)).toBe(true);
  });

  test("validates a control nested inside an added subtree", async () => {
    loadScript();

    const panel = document.createElement("div");
    const field = document.createElement("textarea");
    field.setAttribute("data-setting", SETTING);
    field.value = "٠,١";
    panel.appendChild(field);
    document.body.appendChild(panel);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(field.classList.contains(INVALID_CLASS)).toBe(true);
  });

  test("ignores non-element nodes added to the panel", async () => {
    loadScript();

    document.body.appendChild(document.createTextNode("panel copy"));
    document.body.appendChild(document.createComment("a comment"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const field = addField(ARABIC_INDIC);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(field.classList.contains(INVALID_CLASS)).toBe(false);
  });
});

describe("configuration guard", () => {
  test("does nothing when the localized config is missing", () => {
    delete window.customDigitsCounterEditor;
    const field = addField("definitely invalid");
    loadScript();

    expect(field.classList.contains(INVALID_CLASS)).toBe(false);
  });
});
