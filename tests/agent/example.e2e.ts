// No agent step, so no model call: `npx e2e run tests/agent/example.e2e.ts`
// checks the runner can reach the site without spending credits.
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('app opens', async ({ app, browser }) => {
  await app.open('/');
  await expect(browser.locator('body')).toBeVisible();
});
