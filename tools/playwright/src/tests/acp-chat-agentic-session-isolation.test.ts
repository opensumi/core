// Source: test/bdd/acp-chat-agentic-session-isolation.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const SESSION_PREFIX = 'bdd-session-isolation';
const SEEDED_SESSION_IDS = [`acp:${SESSION_PREFIX}-alpha`, `acp:${SESSION_PREFIX}-beta`];
const SESSION_A_PROMPT = 'BDD history isolation session A';
const SESSION_B_PROMPT = 'BDD history isolation session B';
const METADATA_LEAK_SENTINELS = [
  'BDD_ASSISTANT_PART',
  'BDD_THOUGHT_STEP',
  'BDD_TOOL_RESULT',
  'BDD_USER_TURN',
  'BDD_HISTORY_USER',
  'BDD_HISTORY_THOUGHT',
  'BDD_HISTORY_ASSISTANT',
  'BDD_HISTORY_TOOL_RESULT',
];

let runtime: AcpBddFixtureRuntime;

interface AcpSessionSummary {
  sessionId: string;
  rawSessionId?: string;
  title: string;
  createdAt: number;
  requestCount: number;
  historyMessageCount: number;
  slicedMessageCount: number;
  threadStatus?: string;
}

interface SessionShellProof {
  activeSessionId?: string;
  userRows: number;
  assistantRows: number;
  reasoningToggleCount: number;
  toolCardCount: number;
  sendVisible: boolean;
  stopVisible: boolean;
}

async function loadHistoryWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'history',
    profile: 'interactive',
    delayMs: 20,
    sessionPrefix: SESSION_PREFIX,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1600, height: 900 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
}

async function executeAcpTool<T>(name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ toolName, toolArgs }) => (navigator as any).modelContext.executeTool(toolName, toolArgs),
    { toolName: name, toolArgs: args },
  ) as Promise<{ success: boolean; result: T }>;
}

async function listSessions(): Promise<AcpSessionSummary[]> {
  const result = await executeAcpTool<{ sessions: AcpSessionSummary[]; total: number }>('acp_chat_list_sessions');
  expect(result.success).toBe(true);
  return result.result.sessions;
}

async function getSessionState() {
  const result = await executeAcpTool<{ active: boolean; session: AcpSessionSummary | null }>(
    'acp_chat_get_session_state',
  );
  expect(result.success).toBe(true);
  return result.result;
}

async function waitForSeededSessions(): Promise<AcpSessionSummary[]> {
  await expect
    .poll(
      async () => {
        const sessions = await listSessions();
        return sessions
          .map((session) => session.sessionId)
          .filter((id) => SEEDED_SESSION_IDS.includes(id))
          .sort();
      },
      { timeout: 30_000 },
    )
    .toEqual([...SEEDED_SESSION_IDS].sort());

  return (await listSessions()).filter((session) => SEEDED_SESSION_IDS.includes(session.sessionId));
}

async function ensureHistoryVisible() {
  const inline = page.locator('[data-testid="acp-chat-history-inline"]');
  if (await inline.isVisible().catch(() => false)) {
    return;
  }

  const collapsed = page.locator('[data-testid="acp-chat-history-collapsed"]');
  if (await collapsed.isVisible().catch(() => false)) {
    await page.getByLabel(/Expand Chat History|展开聊天历史/).click();
    await expect(inline).toBeVisible({ timeout: 30_000 });
    return;
  }

  const popoverButton = page.locator('[data-testid="acp-chat-history-button"]');
  await expect(popoverButton).toBeVisible({ timeout: 30_000 });
  await popoverButton.click();
  await expect(page.locator('[data-testid="acp-chat-history-popover"]')).toBeVisible({ timeout: 30_000 });
}

async function clickHistoryItem(sessionId: string) {
  await ensureHistoryVisible();
  const row = page.locator(`[data-testid="chat-history-item-${sessionId}"]`).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect
    .poll(
      async () => {
        const state = await getSessionState();
        return state.session?.sessionId;
      },
      { timeout: 30_000 },
    )
    .toBe(sessionId);
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function sendButton() {
  return chatSlot()
    .getByRole('button', { name: /^(Enter\s+)?Send$|^Enter\s+发送$|^发送$/i })
    .last();
}

async function sendPromptAndWaitForResult(prompt: string) {
  const input = chatInput();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type(prompt);
  await expect(sendButton()).toBeVisible();
  await sendButton().click();

  await expect(page.locator('.AI-Chat-slot').getByText('Called MCP Tool').last()).toBeVisible({ timeout: 30_000 });
  await expect(sendButton()).toBeVisible({ timeout: 30_000 });
}

async function readSessionShellProof(): Promise<SessionShellProof> {
  const state = await getSessionState();
  const ui = await page.evaluate(() => {
    const slot = document.querySelector('.AI-Chat-slot') as HTMLElement | null;
    const text = slot?.innerText || '';
    const countText = (needle: string) => text.split(needle).length - 1;
    const visibleButtons = Array.from(
      slot?.querySelectorAll<HTMLElement>('button, [role="button"], [aria-label]') || [],
    ).filter((button) => {
      const rect = button.getBoundingClientRect();
      const style = window.getComputedStyle(button);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const hasVisibleButton = (pattern: RegExp) =>
      visibleButtons.some((button) =>
        pattern.test([button.innerText, button.getAttribute('aria-label'), button.getAttribute('title')].join(' ')),
      );

    return {
      userRows: slot?.querySelectorAll('.rce-user-msg').length || 0,
      assistantRows: slot?.querySelectorAll('.rce-ai-msg').length || 0,
      reasoningToggleCount: visibleButtons.filter((button) => /Deep Thinking|深度思考/.test(button.innerText)).length,
      toolCardCount: countText('Called MCP Tool'),
      sendVisible: hasVisibleButton(/Send|发送/),
      stopVisible: hasVisibleButton(/Stop|停止/),
    };
  });

  return {
    activeSessionId: state.session?.sessionId,
    ...ui,
  };
}

function expectCompletedSingleTurnShell(proof: SessionShellProof, sessionId: string, baseline: SessionShellProof) {
  expect(proof.activeSessionId).toBe(sessionId);
  expect(proof.userRows).toBe(baseline.userRows + 1);
  expect(proof.assistantRows).toBeGreaterThanOrEqual(baseline.assistantRows + 1);
  expect(proof.assistantRows).toBeLessThanOrEqual(baseline.assistantRows + 2);
  expect(proof.reasoningToggleCount).toBeGreaterThanOrEqual(baseline.reasoningToggleCount + 1);
  expect(proof.toolCardCount).toBe(baseline.toolCardCount + 1);
  expect(proof.sendVisible).toBe(true);
  expect(proof.stopVisible).toBe(false);
}

function expectMetadataOnly(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const sentinel of METADATA_LEAK_SENTINELS) {
    expect(serialized).not.toContain(sentinel);
  }
}

function sessionById(sessions: AcpSessionSummary[], sessionId: string): AcpSessionSummary {
  const session = sessions.find((item) => item.sessionId === sessionId);
  expect(session, `missing session ${sessionId}`).toBeDefined();
  return session!;
}

test.describe('ACP Chat Agentic Session Isolation', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadHistoryWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('Session Isolation keeps history-backed sessions visually and metrically separate', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-session-isolation', {
      sourceScenario: 'test/bdd/acp-chat-agentic-session-isolation.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const [sessionA, sessionB] = await waitForSeededSessions();

    await clickHistoryItem(sessionA.sessionId);
    const sessionABaseline = await readSessionShellProof();
    await clickHistoryItem(sessionB.sessionId);
    const sessionBBaseline = await readSessionShellProof();

    await clickHistoryItem(sessionA.sessionId);
    await sendPromptAndWaitForResult(SESSION_A_PROMPT);
    const sessionAAfterSend = await readSessionShellProof();
    expectCompletedSingleTurnShell(sessionAAfterSend, sessionA.sessionId, sessionABaseline);
    const sessionAProof = await evidence.saveJson(
      '01-session-a-complete',
      sessionAAfterSend,
      'Session A completed one deterministic history-backed turn',
    );

    await clickHistoryItem(sessionB.sessionId);
    const sessionBUnchanged = await readSessionShellProof();
    expect(sessionBUnchanged.activeSessionId).toBe(sessionB.sessionId);
    expect(sessionBUnchanged.userRows).toBe(sessionBBaseline.userRows);
    expect(sessionBUnchanged.assistantRows).toBe(sessionBBaseline.assistantRows);
    expect(sessionBUnchanged.toolCardCount).toBe(sessionBBaseline.toolCardCount);
    expect(sessionBUnchanged.reasoningToggleCount).toBe(sessionBBaseline.reasoningToggleCount);
    const emptySessionBProof = await evidence.saveJson(
      '02-session-b-empty-after-a',
      sessionBUnchanged,
      'Session B baseline stays unchanged after Session A receives updates',
    );

    await sendPromptAndWaitForResult(SESSION_B_PROMPT);
    const sessionBAfterSend = await readSessionShellProof();
    expectCompletedSingleTurnShell(sessionBAfterSend, sessionB.sessionId, sessionBBaseline);
    const sessionBProof = await evidence.saveJson(
      '03-session-b-complete',
      sessionBAfterSend,
      'Session B completed one deterministic history-backed turn',
    );

    await clickHistoryItem(sessionA.sessionId);
    const sessionARestored = await readSessionShellProof();
    expectCompletedSingleTurnShell(sessionARestored, sessionA.sessionId, sessionABaseline);

    await clickHistoryItem(sessionB.sessionId);
    const sessionBRestored = await readSessionShellProof();
    expectCompletedSingleTurnShell(sessionBRestored, sessionB.sessionId, sessionBBaseline);
    const restoredProof = await evidence.saveJson(
      '04-switch-back-and-forth',
      { sessionA: sessionARestored, sessionB: sessionBRestored },
      'Switching back and forth keeps each history-backed session bounded to one visible turn',
    );

    const sessions = await listSessions();
    const state = await getSessionState();
    const summaryA = sessionById(sessions, sessionA.sessionId);
    const summaryB = sessionById(sessions, sessionB.sessionId);
    expect(summaryA.requestCount).toBe(1);
    expect(summaryB.requestCount).toBe(1);
    expect(state.session?.sessionId).toBe(sessionB.sessionId);
    expectMetadataOnly({ state, sessions });
    const metadataProof = await evidence.saveJson(
      '05-metadata-isolated',
      { state, summaryA, summaryB },
      'List and state tools expose bounded per-session metadata after history-backed isolation checks',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Session A can complete a deterministic history-backed turn.',
      status: 'pass',
      evidence: [sessionAProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement:
        'Session B does not receive Session A visible rows, reasoning UI, or tool cards before its own turn.',
      status: 'pass',
      evidence: [emptySessionBProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Session B can complete its own deterministic turn and remain visually separate.',
      status: 'pass',
      evidence: [sessionBProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement: 'Switching back and forth keeps each session bounded to its own one-turn shell.',
      status: 'pass',
      evidence: [restoredProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP5',
      requirement: 'Per-session request counts remain isolated in metadata-only list/state tools.',
      status: 'pass',
      evidence: [metadataProof].filter(Boolean) as string[],
      notes: 'Concurrent long-stream isolation remains out of scope for this history-only fixture pass.',
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
