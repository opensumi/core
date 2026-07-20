// Source: test/bdd/acp-chat-agentic-session-isolation.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { launchTaskInCurrentProject } from './utils/acp-task-list';
import { createBddEvidence } from './utils/bdd-evidence';

const SESSION_PREFIX = 'bdd-session-isolation';
const SESSION_A_BASELINE_PROMPT = 'BDD history isolation baseline A';
const SESSION_B_BASELINE_PROMPT = 'BDD history isolation baseline B';
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

async function selectTask(sessionId: string) {
  const row = page.getByTestId(`agentic-task-row-${sessionId}`);
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

async function startTaskInCurrentProject() {
  const agentLabel = await launchTaskInCurrentProject(page);
  expect(agentLabel).toBeTruthy();
  await expect.poll(async () => (await getSessionState()).active, { timeout: 30_000 }).toBe(false);
}

async function refreshTaskList() {
  const search = page.getByPlaceholder('Search tasks');
  await search.fill('BDD history isolation');
  await search.fill('');
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

  await expect(
    page
      .locator('.AI-Chat-slot')
      .getByText(/Called (?:MCP )?Tool/)
      .last(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(sendButton()).toBeVisible({ timeout: 30_000 });
}

async function createTaskWithBaseline(prompt: string): Promise<AcpSessionSummary> {
  await startTaskInCurrentProject();
  await sendPromptAndWaitForResult(prompt);
  const session = (await getSessionState()).session;
  expect(session).not.toBeNull();
  await refreshTaskList();
  await expect(page.getByTestId(`agentic-task-row-${session!.sessionId}`)).toBeVisible({ timeout: 30_000 });
  return session!;
}

async function readSessionShellProof(): Promise<SessionShellProof> {
  const state = await getSessionState();
  const ui = await page.evaluate(() => {
    const slot = document.querySelector('.AI-Chat-slot') as HTMLElement | null;
    const isVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const text = slot?.innerText || '';
    const normalizedText = text.replace(/\s+/g, ' ');
    const countToolText = () => normalizedText.match(/Called\s+(?:MCP\s+)?Tool/g)?.length || 0;
    const visibleButtons = Array.from(
      slot?.querySelectorAll<HTMLElement>('button, [role="button"], [aria-label]') || [],
    ).filter(isVisible);
    const visibleToolCards = Array.from(
      slot?.querySelectorAll<HTMLElement>('[class*="chat_tool_render"]') || [],
    ).filter(isVisible).length;
    const hasVisibleButton = (pattern: RegExp) =>
      visibleButtons.some((button) =>
        [button.innerText, button.getAttribute('aria-label'), button.getAttribute('title')].some((value) =>
          pattern.test((value || '').trim()),
        ),
      );

    return {
      userRows: Array.from(slot?.querySelectorAll<HTMLElement>('.rce-user-msg') || []).filter(isVisible).length,
      assistantRows: Array.from(slot?.querySelectorAll<HTMLElement>('.rce-ai-msg') || []).filter(isVisible).length,
      reasoningToggleCount: visibleButtons.filter((button) => /Deep Thinking|深度思考/.test(button.innerText)).length,
      toolCardCount: Math.max(visibleToolCards, countToolText()),
      sendVisible: hasVisibleButton(/^(?:Enter\s+)?Send$|^Enter\s+发送$|^发送$/i),
      stopVisible: hasVisibleButton(/^Stop$|^停止$/i),
    };
  });

  return {
    activeSessionId: state.session?.sessionId,
    ...ui,
  };
}

function expectHistorySessionShell(proof: SessionShellProof, sessionId: string) {
  expect(proof.activeSessionId).toBe(sessionId);
  expect(proof.userRows).toBeGreaterThanOrEqual(1);
  expect(proof.assistantRows).toBeGreaterThanOrEqual(1);
  expect(proof.sendVisible).toBe(true);
  expect(proof.stopVisible).toBe(false);
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

function expectSessionShellUnchanged(proof: SessionShellProof, sessionId: string, baseline: SessionShellProof) {
  expect(proof.activeSessionId).toBe(sessionId);
  expect(proof.userRows).toBe(baseline.userRows);
  expect(proof.assistantRows).toBe(baseline.assistantRows);
  expect(proof.toolCardCount).toBe(baseline.toolCardCount);
  expect(proof.reasoningToggleCount).toBe(baseline.reasoningToggleCount);
  expect(proof.sendVisible).toBe(true);
  expect(proof.stopVisible).toBe(false);
}

function sessionShellSignature(proof: SessionShellProof): string {
  return [
    proof.activeSessionId,
    proof.userRows,
    proof.assistantRows,
    proof.reasoningToggleCount,
    proof.toolCardCount,
    proof.sendVisible,
    proof.stopVisible,
  ].join(':');
}

async function waitForSettledSessionShell(assertShell: (proof: SessionShellProof) => void): Promise<SessionShellProof> {
  let proof = await readSessionShellProof();

  await expect
    .poll(
      async () => {
        const first = await readSessionShellProof();
        try {
          assertShell(first);
        } catch {
          return false;
        }

        await page.waitForTimeout(150);
        const second = await readSessionShellProof();
        try {
          assertShell(second);
        } catch {
          return false;
        }

        if (sessionShellSignature(first) !== sessionShellSignature(second)) {
          return false;
        }

        proof = second;
        return true;
      },
      { timeout: 30_000 },
    )
    .toBe(true);

  assertShell(proof);
  return proof;
}

function waitForHistorySessionShell(sessionId: string): Promise<SessionShellProof> {
  return waitForSettledSessionShell((proof) => expectHistorySessionShell(proof, sessionId));
}

function waitForCompletedSingleTurnShell(sessionId: string, baseline: SessionShellProof): Promise<SessionShellProof> {
  return waitForSettledSessionShell((proof) => expectCompletedSingleTurnShell(proof, sessionId, baseline));
}

function waitForSessionShellUnchanged(sessionId: string, baseline: SessionShellProof): Promise<SessionShellProof> {
  return waitForSettledSessionShell((proof) => expectSessionShellUnchanged(proof, sessionId, baseline));
}

function expectMetadataOnly(value: unknown) {
  const omitAllowedTitleMetadata = (item: unknown): unknown => {
    if (Array.isArray(item)) {
      return item.map(omitAllowedTitleMetadata);
    }
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item).flatMap(([key, nestedValue]) =>
          key === 'title' || key === 'sourceTitle' ? [] : [[key, omitAllowedTitleMetadata(nestedValue)]],
        ),
      );
    }
    return item;
  };
  const serialized = JSON.stringify(omitAllowedTitleMetadata(value));
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

  test('通过 Agent Tasks 切换时两个会话的可见内容和指标保持隔离', async ({ browser: _browser }, testInfo) => {
    void _browser;

    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-session-isolation', {
      sourceScenario: 'test/bdd/acp-chat-agentic-session-isolation.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const sessionA = await createTaskWithBaseline(SESSION_A_BASELINE_PROMPT);
    const sessionB = await createTaskWithBaseline(SESSION_B_BASELINE_PROMPT);

    await selectTask(sessionA.sessionId);
    const sessionABaseline = await waitForHistorySessionShell(sessionA.sessionId);
    await selectTask(sessionB.sessionId);
    const sessionBBaseline = await waitForHistorySessionShell(sessionB.sessionId);

    await selectTask(sessionA.sessionId);
    await sendPromptAndWaitForResult(SESSION_A_PROMPT);
    const sessionAAfterSend = await waitForCompletedSingleTurnShell(sessionA.sessionId, sessionABaseline);
    const sessionAProof = await evidence.saveJson(
      '01-session-a-complete',
      sessionAAfterSend,
      'Session A completed one deterministic history-backed turn',
    );

    await selectTask(sessionB.sessionId);
    const sessionBUnchanged = await waitForSessionShellUnchanged(sessionB.sessionId, sessionBBaseline);
    const emptySessionBProof = await evidence.saveJson(
      '02-session-b-empty-after-a',
      sessionBUnchanged,
      'Session B baseline stays unchanged after Session A receives updates',
    );

    await sendPromptAndWaitForResult(SESSION_B_PROMPT);
    const sessionBAfterSend = await waitForCompletedSingleTurnShell(sessionB.sessionId, sessionBBaseline);
    const sessionBProof = await evidence.saveJson(
      '03-session-b-complete',
      sessionBAfterSend,
      'Session B completed one deterministic history-backed turn',
    );

    await selectTask(sessionA.sessionId);
    const sessionARestored = await waitForCompletedSingleTurnShell(sessionA.sessionId, sessionABaseline);

    await selectTask(sessionB.sessionId);
    const sessionBRestored = await waitForCompletedSingleTurnShell(sessionB.sessionId, sessionBBaseline);
    const restoredProof = await evidence.saveJson(
      '04-switch-back-and-forth',
      { sessionA: sessionARestored, sessionB: sessionBRestored },
      'Switching back and forth keeps each history-backed session bounded to one visible turn',
    );

    const sessions = await listSessions();
    const state = await getSessionState();
    const summaryA = sessionById(sessions, sessionA.sessionId);
    const summaryB = sessionById(sessions, sessionB.sessionId);
    expect(summaryA.requestCount).toBe(2);
    expect(summaryB.requestCount).toBe(2);
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
