// Source: test/bdd/acp-chat-agentic-cancel-stop.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const LONG_STREAM_PROMPT = 'BDD cancel stop long stream';
const ACTIVE_STREAM_SENTINEL = 'BDD_LONG_STREAM_CHUNK_02';
const POST_CANCEL_DRAFT = 'BDD post cancel draft';

let runtime: AcpBddFixtureRuntime;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

async function loadLongStreamWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'long-stream',
    profile: 'interactive',
    delayMs: 40,
    longStreamTicks: 120,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1600, height: 900 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

function chatButton(name: string) {
  return chatSlot().getByRole('button', { name, exact: true });
}

async function sendPrompt(prompt: string) {
  const input = chatInput();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type(prompt);
  await chatButton('Send').click();
}

test.describe('ACP Chat Agentic Cancel Stop', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadLongStreamWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('Cancel Stop returns the input to a usable state during the long-stream fixture', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-cancel-stop', {
      sourceScenario: 'test/bdd/acp-chat-agentic-cancel-stop.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await sendPrompt(LONG_STREAM_PROMPT);

    await expect(chatSlot().locator('.rce-user-msg')).toHaveCount(1, { timeout: 30_000 });
    await expect(chatSlot().getByText(ACTIVE_STREAM_SENTINEL)).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeVisible();

    const activeProof = await evidence.saveJson(
      '01-active-stream',
      {
        userRows: await chatSlot().locator('.rce-user-msg').count(),
        assistantRows: await chatSlot().locator('.rce-ai-msg').count(),
        hasActiveSentinel: await chatSlot().getByText(ACTIVE_STREAM_SENTINEL).isVisible(),
        stopVisible: await chatButton('Stop').isVisible(),
      },
      'long-stream request shows active content and a stop affordance',
    );

    await chatButton('Stop').click();
    await expect(chatButton('Send')).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeHidden();

    const input = chatInput();
    await input.click();
    await page.keyboard.type(POST_CANCEL_DRAFT);
    await expect(input).toContainText(POST_CANCEL_DRAFT);

    const stoppedProof = await evidence.saveJson(
      '02-stopped-input-usable',
      {
        sendVisible: await chatButton('Send').isVisible(),
        stopVisible: await chatButton('Stop')
          .isVisible()
          .catch(() => false),
        inputText: await input.textContent(),
      },
      'stopping the long stream restores the send affordance and editable input',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'The long-stream fixture visibly enters active streaming state.',
      status: 'pass',
      evidence: [activeProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'A user-facing stop control is visible while the stream is active.',
      status: 'pass',
      evidence: [activeProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Stopping the stream returns the Agentic input to a usable state.',
      status: 'pass',
      evidence: [stoppedProof].filter(Boolean) as string[],
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
