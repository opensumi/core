// Source: test/bdd/acp-chat-agentic-reload-during-stream.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const LONG_STREAM_PROMPT = 'BDD reload during long stream';
const ACTIVE_STREAM_SENTINEL = 'BDD_LONG_STREAM_CHUNK_02';

let runtime: AcpBddFixtureRuntime;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

async function loadLongStreamWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'long-stream',
    profile: 'interactive',
    delayMs: 40,
    longStreamTicks: 1000,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1600, height: 900 },
  });
  await expect(page.locator('.AI-Chat-slot [contenteditable="true"]').last()).toBeVisible();
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

async function showAcpChatView() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await ensureAgenticLayout(page);
}

async function getSessionState() {
  const result = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  expect(result.success).toBe(true);
  return result.result as {
    active: boolean;
    session: { sessionId?: string; threadStatus?: string; requestCount?: number } | null;
  };
}

async function getHighestVisibleStreamChunk(): Promise<number> {
  const text = (await chatSlot().textContent()) || '';
  return Array.from(text.matchAll(/BDD_LONG_STREAM_CHUNK_(\d+)/g)).reduce(
    (highest, match) => Math.max(highest, Number(match[1])),
    0,
  );
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
    const beforeReloadState = await getSessionState();

    const beforeReloadProof = await evidence.saveJson(
      '01-active-before-reload',
      {
        url: page.url(),
        hasActiveSentinel: await chatSlot().getByText(ACTIVE_STREAM_SENTINEL).isVisible(),
        stopVisible: await chatButton('Stop').isVisible(),
        session: beforeReloadState.session,
      },
      'long-stream request is active immediately before browser reload',
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await showAcpChatView();

    await expect(chatSlot()).toBeVisible({ timeout: 30_000 });
    await expect(chatSlot().getByText(ACTIVE_STREAM_SENTINEL)).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeVisible({ timeout: 30_000 });
    const afterReloadState = await getSessionState();
    const restoredHighestChunk = await getHighestVisibleStreamChunk();
    const continuedChunk = restoredHighestChunk + 5;
    const continuedStreamSentinel = `BDD_LONG_STREAM_CHUNK_${String(continuedChunk).padStart(2, '0')}`;
    await expect(chatSlot().getByText(continuedStreamSentinel)).toBeVisible({ timeout: 30_000 });

    expect(afterReloadState.active).toBe(true);
    expect(afterReloadState.session?.sessionId).toBe(beforeReloadState.session?.sessionId);
    expect(afterReloadState.session?.threadStatus).toBe('working');
    expect(afterReloadState.session?.requestCount).toBe(1);

    const afterReloadProof = await evidence.saveJson(
      '02-usable-after-reload',
      {
        url: page.url(),
        chatVisible: await chatSlot().isVisible(),
        restoredActiveSentinel: await chatSlot().getByText(ACTIVE_STREAM_SENTINEL).isVisible(),
        restoredHighestChunk,
        continuedChunk,
        continuedStreamSentinel: await chatSlot().getByText(continuedStreamSentinel).isVisible(),
        stopVisible: await chatButton('Stop').isVisible(),
        session: afterReloadState.session,
      },
      'browser reload restores the same running Agentic session and continued output',
    );

    await chatButton('Stop').click();
    await expect(chatButton('Send')).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeHidden();
    const stoppedState = await getSessionState();
    expect(stoppedState.active).toBe(true);
    expect(stoppedState.session?.sessionId).toBe(beforeReloadState.session?.sessionId);
    expect(stoppedState.session?.requestCount).toBe(1);

    const stoppedProof = await evidence.saveJson(
      '03-stopped-after-reattach',
      {
        sendVisible: await chatButton('Send').isVisible(),
        stopVisible: await chatButton('Stop')
          .isVisible()
          .catch(() => false),
        session: stoppedState.session,
      },
      'the replacement browser connection can explicitly stop the restored running task',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'The deterministic long-stream fixture is visibly active before reload.',
      status: 'pass',
      evidence: [beforeReloadProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Reload restores the same running session, prior output, and continued output without resending.',
      status: 'pass',
      evidence: [afterReloadProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'The restored Stop control cancels the same task through the replacement browser connection.',
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
