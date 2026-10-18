/**
 * Agent test: the plugin's main flow, done the way a site builder does it.
 *
 * The Playwright suite proves the conversion on a page whose digit set is
 * already saved. This one starts in the Elementor editor: the agent finds the
 * Custom Digits field on a counter that has none, enters a set and publishes,
 * and the page a visitor then loads must count up in that set.
 */

import { readFileSync } from 'node:fs';

import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

const STATE_FILE = new URL('./output/state.json', import.meta.url);

const DEVANAGARI = '०,१,२,३,४,५,६,७,८,९';

// Widget B of tests/lib/counter-page.json, the fixture's counter without a
// digit set. Elementor groups the count-up's thousands, hence the comma.
const COUNTER = {
  id: 'w2c07207',
  title: 'B: control, no custom digits (512 -> 1999)',
  last: '१,९९९',
};

/** Reads what run.js set up: the fixture page and the admin's sign-in cookies. */
function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    throw new Error(`${STATE_FILE.pathname} is missing — run this suite with: npm run test:agent`);
  }
}

test('a site builder gives a counter its own digits and visitors see it count up in them', async ({
  agent,
  app,
  browser,
  screen,
}) => {
  const { postId, permalink, cookies } = readState();

  await browser.setCookies(cookies);
  await app.open(`/wp-admin/post.php?post=${postId}&action=elementor`);

  // Naming what to click keeps weaker models from tapping guessed points on a
  // screenshot of the preview and reporting success without checking.
  await agent.act('select the counter by clicking its caption {title} in the page preview', {
    params: { title: COUNTER.title },
  });
  await expect(screen.getByRole('textbox', 'Title')).toHaveValue(COUNTER.title);

  await agent.act('enter {digits} in the Custom Digits field of this counter', { params: { digits: DEVANAGARI } });
  await expect(screen.getByRole('textbox', 'Custom Digits')).toHaveValue(DEVANAGARI);

  await agent.act('publish the changes');
  await expect(screen.getByRole('button', 'Publish')).toBeDisabled({ timeout: 15_000 });

  // Signed out, as a visitor: other plugins show admins notices that can cover
  // the counter, such as GTranslate's Translation Mode tour.
  await app.clearState();
  await app.open(permalink);

  const number = browser.locator(`.elementor-element-${COUNTER.id} .elementor-counter-number`);

  // Elementor starts the count-up only once the counter is in view.
  await number.scrollIntoView();
  await expect(number).toHaveText(COUNTER.last, { timeout: 15_000 });

  // The exact check above reads the DOM; only a look at the page proves the
  // theme's font actually has these glyphs rather than painting empty boxes.
  // Hence the screenshot alone: given the DOM too, the model reads the text
  // from it. It is not asked which script, which the DOM check already pinned:
  // Devanagari ९ and Persian ۹ look alike, and models confuse them. Nor is a
  // counter named by its caption: B's still reads "no custom digits", which a
  // judge took as a reason to expect Latin. Both numbers are non-Latin by now.
  await agent.assert(
    'both large counter numbers are shown in non-Latin digits, every digit drawn as a real glyph rather than an empty box',
    { vision: 'only' },
  );
});
