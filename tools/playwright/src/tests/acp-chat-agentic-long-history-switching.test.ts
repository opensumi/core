import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  clearAcpBddTransientSessionState,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForAcpChatReady,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';
import { launchTaskInCurrentProject } from './utils/acp-task-list';

const SESSION_PREFIX = 'bdd-long-history-switching';
const HISTORY_MESSAGE_COUNT = 1000;
const MAX_MOUNTED_MESSAGE_ROWS = 80;

let runtime: AcpBddFixtureRuntime;

interface AcpSessionSummary {
  sessionId: string;
  historyMessageCount: number;
}

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

function sendButton() {
  return chatSlot()
    .getByRole('button', { name: /^(Enter\s+)?Send$|^Enter\s+发送$|^发送$/i })
    .last();
}

async function waitForTaskRow(sessionId: string) {
  const search = page.getByPlaceholder('Search tasks');
  await search.fill('Long history switching');
  await search.fill('');
  const row = page.getByTestId(`agentic-task-row-${sessionId}`);
  await expect(row).toBeVisible({ timeout: 60_000 });
  return row;
}

async function getSessionState() {
  const result = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  expect(result.success).toBe(true);
  return result.result as { active: boolean; session: AcpSessionSummary | null };
}

async function launchTask(prompt: string): Promise<string> {
  await launchTaskInCurrentProject(page);
  await expect.poll(async () => (await getSessionState()).active, { timeout: 30_000 }).toBe(false);
  await expect(chatInput()).toBeVisible();
  await chatInput().click();
  await page.keyboard.insertText(prompt);
  await sendButton().click();
  await expect.poll(async () => (await getSessionState()).session?.historyMessageCount, { timeout: 30_000 }).toBe(2);
  await expect(page.getByTestId('agentic-message-row')).toHaveCount(2, { timeout: 30_000 });
  await expect(chatSlot().getByText('BDD_ASSISTANT_PART_2 completed.').last()).toBeVisible({ timeout: 30_000 });
  const sessionId = (await getSessionState()).session?.sessionId;
  expect(sessionId).toBeTruthy();
  await waitForTaskRow(sessionId!);
  return sessionId!;
}

async function showAgenticChat() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await waitForAcpChatReady(page);
  await ensureAgenticLayout(page);
}

async function selectTask(sessionId: string) {
  const row = await waitForTaskRow(sessionId);
  await row.click();
  await expect.poll(async () => (await getSessionState()).session?.sessionId, { timeout: 60_000 }).toBe(sessionId);
  await expect(page.getByTestId('acp-live-connecting')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByTestId('agentic-virtual-message-list')).toBeVisible();
}

async function expectBoundedRows() {
  const mountedRows = page.getByTestId('agentic-message-row');
  await expect.poll(() => mountedRows.count(), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect.poll(() => mountedRows.count(), { timeout: 30_000 }).toBeLessThanOrEqual(MAX_MOUNTED_MESSAGE_ROWS);
}

async function expectVisibleSessionRows(sessionId: string) {
  const messageList = page.getByTestId('agentic-virtual-message-list');
  await expect(
    messageList.getByText(new RegExp(`BDD_LONG_HISTORY_${longHistorySeed(sessionId)}_`)).first(),
  ).toBeVisible({
    timeout: 30_000,
  });
}

function longHistorySeed(sessionId: string): string {
  return `LONG-${sessionId
    .replace(/^acp:/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .slice(-12)}`.toUpperCase();
}

test.describe('ACP Chat Agentic long-history switching', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 2);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'history',
      profile: 'interactive',
      delayMs: 0,
      historyMessageCount: HISTORY_MESSAGE_COUNT,
      sessionPrefix: SESSION_PREFIX,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('switches two 1000-message Tasks without page reload, unbounded DOM, replay, or mixed session content', async () => {
    const alphaSessionId = await launchTask('Long history switching Alpha');
    const betaSessionId = await launchTask('Long history switching Beta');

    await page.evaluate(async () => {
      const disposeAcpSessions = (window as any).__OPENSUMI_E2E__?.disposeAcpSessions;
      if (typeof disposeAcpSessions !== 'function') {
        throw new Error('OpenSumi E2E ACP session release hook is unavailable');
      }
      await disposeAcpSessions();
    });
    await clearAcpBddTransientSessionState(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await showAgenticChat();

    await selectTask(alphaSessionId);
    await expectBoundedRows();
    await expectVisibleSessionRows(alphaSessionId);
    expect((await getSessionState()).session?.historyMessageCount).toBe(HISTORY_MESSAGE_COUNT);

    const betaRow = await waitForTaskRow(betaSessionId);
    await betaRow.click();
    await expect
      .poll(async () => (await getSessionState()).session?.sessionId, { timeout: 60_000 })
      .toBe(betaSessionId);
    await expect(page.getByTestId('acp-live-connecting')).toHaveCount(0, { timeout: 60_000 });
    await expectVisibleSessionRows(betaSessionId);
    await expect(page.getByText(new RegExp(`BDD_LONG_HISTORY_${longHistorySeed(alphaSessionId)}_`))).toHaveCount(0);
    expect((await getSessionState()).session?.historyMessageCount).toBe(HISTORY_MESSAGE_COUNT);
    await expectBoundedRows();

    await selectTask(alphaSessionId);
    await expectBoundedRows();
    await expectVisibleSessionRows(alphaSessionId);
    expect((await getSessionState()).session?.historyMessageCount).toBe(HISTORY_MESSAGE_COUNT);
  });
});
