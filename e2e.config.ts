import type { E2EConfig } from 'e2e';
import { existsSync } from 'node:fs';
import { google } from '@ai-sdk/google';
import { web } from '@e2e-dev/web';
import { opencodeConsole } from 'e2e/oauth/opencode-console';

// API keys stay out of the repo: .env is gitignored and excluded from the zip.
// The runner loads no .env by itself, and its workers re-import this file.
const ENV_FILE = new URL('./.env', import.meta.url);

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

// Agents never inherit from each other, so every agent spreads these.
const instructions = {
  system: 'You are a thorough QA agent. Verify every outcome.',
  context:
    'A WordPress site built with the Elementor page builder. The Elementor editor shows a settings panel on the left ' +
    'and a live preview of the page on the right; selecting a widget fills the panel with its settings, grouped in ' +
    'collapsible sections under the Content, Style and Advanced tabs. Once a counter is selected, the panel\'s Title ' +
    'field shows that counter\'s caption. Publish is enabled only while there are unsaved ' +
    'changes: after a click it shows progress and then turns disabled, which is the only sign the page was saved.',
};

export default {
  // Kept apart from tests/e2e, whose *.spec.js files belong to Playwright.
  tests: 'tests/agent/**/*.e2e.ts',
  agents: {
    default: {
      // OpenCode Go, billed to the workspace's Go subscription. The cheapest
      // model that passed reliably: Claude Haiku 5.5 passes too at twice the
      // tokens, and the free preview models time out. Sign in once with
      // `npx e2e login opencode-console`; in CI, set OPENCODE_API_KEY instead.
      // OpenCode serves GPT models over the OpenAI Responses API, so this needs
      // @ai-sdk/openai beside @ai-sdk/openai-compatible; a Claude model would
      // need @ai-sdk/anthropic installed.
      model: opencodeConsole('go/gpt-6-luna'),
      ...instructions,
    },
    // The free fallback for when the OpenCode subscription lapses:
    // `npm run test:agent -- --agent gemini`. Google AI Studio's free tier,
    // keyed by GOOGLE_GENERATIVE_AI_API_KEY in .env; Google may use free-tier
    // requests to improve its products.
    gemini: {
      model: google('gemini-3.5-flash-lite'),
      ...instructions,
    },
  },
  targets: [{
    engine: web(),
    // The wp-env site the other suites use; `npm run test:agent` boots it and
    // publishes the fixture page before the run.
    app: { url: `http://localhost:${process.env.WP_ENV_PORT ?? '8888'}` },
  }],
} satisfies E2EConfig;
