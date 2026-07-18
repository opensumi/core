// Source: test/bdd/acp-chat-agentic-queued-turns.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

let runtime: AcpBddFixtureRuntime;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function mainInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

async function submit(text: string): Promise<void> {
  const input = mainInput();
  await expect(input).toBeVisible();
  await input.click();
  await input.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
  await chatSlot().getByRole('button', { name: 'Send', exact: true }).click();
}

test.describe('ACP Chat Agentic Queued Turns', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'long-stream',
      profile: 'interactive',
      delayMs: 40,
      longStreamTicks: 120,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('renders the actual queued count during an active request', async ({ browser: _browser }, testInfo) => {
    void _browser;
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-queued-turns', {
      sourceScenario: 'test/bdd/acp-chat-agentic-queued-turns.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await submit('count-active');
    await expect(chatSlot().getByRole('button', { name: 'Stop', exact: true })).toBeVisible({ timeout: 30_000 });
    await submit('count-1');
    await submit('count-2');

    const summary = page.getByTestId('acp-queued-turns-summary');
    await expect(page.getByTestId('acp-queued-turn')).toHaveCount(2);
    await expect(summary).toContainText('2 Queued Turns');
    await expect(summary).not.toContainText('{0}');
    const countProof = await evidence.saveJson(
      '01-queued-turn-count',
      { count: await page.getByTestId('acp-queued-turn').count(), title: await summary.textContent() },
      'Two queued entries render a localized count without an unresolved placeholder',
    );
    const screenshot = await evidence.captureScreenshot(
      page,
      '02-queued-turn-count',
      'The visible queue has two entries and no unresolved localization placeholder',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Queue summaries display their actual counts and never expose {0}.',
      status: 'pass',
      evidence: [countProof, screenshot].filter(Boolean) as string[],
    });
    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
        fixture: runtime.fixture,
        profile: runtime.profile,
      },
    });
  });
});
