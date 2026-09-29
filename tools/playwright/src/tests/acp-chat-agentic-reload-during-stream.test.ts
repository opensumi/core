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
import { launchTaskInCurrentProject } from './utils/acp-task-list';
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
    longStreamTicks: 3000,
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
    void _browser;
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-reload-during-stream', {
      sourceScenario: 'test/bdd/acp-chat-agentic-reload-during-stream.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await launchTaskInCurrentProject(page);
    await sendPrompt(LONG_STREAM_PROMPT);
    await expect(chatSlot().getByText(ACTIVE_STREAM_SENTINEL)).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeVisible();
    const beforeReloadState = await getSessionState();
    const beforeReloadHighestChunk = await getHighestVisibleStreamChunk();
    const activeSessionId = beforeReloadState.session?.sessionId;
    expect(activeSessionId).toBeTruthy();
    const activeSessionRow = page.getByTestId(`agentic-session-row-${activeSessionId}`);
    await expect(activeSessionRow).toBeVisible({ timeout: 30_000 });
    await expect(activeSessionRow).toHaveAttribute('aria-current', 'true');

    const beforeReloadProof = await evidence.saveJson(
      '01-active-before-reload',
      {
        url: page.url(),
        hasActiveSentinel: await chatSlot().getByText(ACTIVE_STREAM_SENTINEL).isVisible(),
        highestChunk: beforeReloadHighestChunk,
        stopVisible: await chatButton('Stop').isVisible(),
        session: beforeReloadState.session,
      },
      'long-stream request is active immediately before browser reload',
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await showAcpChatView();

    await expect(chatSlot()).toBeVisible({ timeout: 30_000 });
    const restoredSessionRow = page.getByTestId(`agentic-session-row-${activeSessionId}`);
    await expect(restoredSessionRow).toBeVisible({ timeout: 30_000 });
    await expect(chatInput()).toBeVisible({ timeout: 30_000 });
    await expect(chatInput()).toBeEditable({ timeout: 30_000 });
    const afterReloadState = await getSessionState();
    const restoredHighestChunk = await getHighestVisibleStreamChunk();
    expect(restoredHighestChunk).toBeLessThanOrEqual(beforeReloadHighestChunk);

    const afterReloadProof = await evidence.saveJson(
      '02-usable-after-reload',
      {
        url: page.url(),
        chatVisible: await chatSlot().isVisible(),
        restoredSessionRowVisible: await restoredSessionRow.isVisible(),
        restoredHighestChunk,
        inputEditable: await chatInput().isEditable(),
        session: afterReloadState.session,
      },
      'browser reload returns a usable Session Browser without synthesizing local transcript restoration',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'The deterministic long-stream fixture is visibly active before reload.',
      status: 'pass',
      evidence: [beforeReloadProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement:
        'Reload returns a usable Agent Session Browser without relying on legacy local active-session state.',
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
