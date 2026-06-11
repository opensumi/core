// Source: test/bdd/acp-chat-agentic-reload-during-stream.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForAcpChatReady,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const LONG_STREAM_PROMPT = 'BDD reload during long stream';
const ACTIVE_STREAM_SENTINEL = 'BDD_LONG_STREAM_CHUNK_02';
const POST_RELOAD_DRAFT = 'BDD post reload draft';

let runtime: AcpBddFixtureRuntime;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

async function loadLongStreamWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'long-stream',
    profile: 'interactive',
    delayMs: 40,
    longStreamTicks: 160,
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
  return chatSlot().getByRole('button', { name });
}

async function sendPrompt(prompt: string) {
  const input = chatInput();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type(prompt);
  await chatButton('Send').click();
}

async function showAcpChatView() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await waitForAcpChatReady(page);
  await ensureAgenticLayout(page);
}

test.describe('ACP Chat Agentic Reload During Stream', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadLongStreamWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('Reload During Stream recovers to a usable Agentic chat shell', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-reload-during-stream', {
      sourceScenario: 'test/bdd/acp-chat-agentic-reload-during-stream.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await sendPrompt(LONG_STREAM_PROMPT);
    await expect(chatSlot().getByText(ACTIVE_STREAM_SENTINEL)).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeVisible();

    const beforeReloadProof = await evidence.saveJson(
      '01-active-before-reload',
      {
        url: page.url(),
        hasActiveSentinel: await chatSlot().getByText(ACTIVE_STREAM_SENTINEL).isVisible(),
        stopVisible: await chatButton('Stop').isVisible(),
      },
      'long-stream request is active immediately before browser reload',
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await showAcpChatView();

    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Send')).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeHidden();

    const input = chatInput();
    await expect(input).toBeVisible();
    await input.click();
    await page.keyboard.type(POST_RELOAD_DRAFT);
    await expect(input).toContainText(POST_RELOAD_DRAFT);

    const afterReloadProof = await evidence.saveJson(
      '02-usable-after-reload',
      {
        url: page.url(),
        headingVisible: await page.getByRole('heading', { name: 'AI Assistant' }).isVisible(),
        sendVisible: await chatButton('Send').isVisible(),
        stopVisible: await chatButton('Stop')
          .isVisible()
          .catch(() => false),
        inputText: await input.textContent(),
      },
      'browser reload recovers to a usable Agentic chat shell',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'The deterministic long-stream fixture is visibly active before reload.',
      status: 'pass',
      evidence: [beforeReloadProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Reload returns to the same workspace with a usable Agentic chat shell.',
      status: 'pass',
      evidence: [afterReloadProof].filter(Boolean) as string[],
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
