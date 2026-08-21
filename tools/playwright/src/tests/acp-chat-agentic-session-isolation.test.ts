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
  headerTitle: string;
  messageRows: number;
  requestCount: number;
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
  const row = page.getByTestId(`agentic-session-row-${sessionId}`);
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
  await expect(row).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('acp-live-connecting')).toHaveCount(0, { timeout: 30_000 });
  await expect(chatInput()).toBeEditable({ timeout: 30_000 });
  await expect(sendButton()).toHaveAttribute('tabindex', '0', { timeout: 30_000 });
}

async function startTaskInCurrentProject() {
  const agentLabel = await launchTaskInCurrentProject(page);
  expect(agentLabel).toBeTruthy();
  await expect(chatInput()).toBeVisible();
}

async function refreshTaskList() {
  const search = page.getByPlaceholder('Search sessions');
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

async function sendPromptAndWaitForResult(prompt: string, expectedSessionId?: string) {
  const beforeSend = await getSessionState();
  const activeSessionId = beforeSend.session?.sessionId;
  if (expectedSessionId) {
    expect(activeSessionId).toBe(expectedSessionId);
  }
  const previousRequestCount = beforeSend.session?.requestCount ?? 0;
  const input = chatInput();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type(prompt);
  await expect(input).toContainText(prompt);
  await expect(page.getByTestId('acp-live-connecting')).toHaveCount(0, { timeout: 30_000 });
  const submit = sendButton();
  await expect(submit).toHaveAttribute('tabindex', '0', { timeout: 30_000 });
  await submit.click();

  if (expectedSessionId) {
    await expect
      .poll(
        async () => {
          const state = await getSessionState();
          return { requestCount: state.session?.requestCount ?? 0, sessionId: state.session?.sessionId };
        },
        { timeout: 30_000 },
      )
      .toEqual({ requestCount: previousRequestCount + 1, sessionId: expectedSessionId });
  } else {
    await expect
      .poll(async () => (await getSessionState()).session?.requestCount ?? 0, { timeout: 30_000 })
      .toBe(previousRequestCount + 1);
  }

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
  await expect(page.getByTestId(`agentic-session-row-${session!.sessionId}`)).toBeVisible({ timeout: 30_000 });
  return session!;
}

async function waitForSessionShell(session: AcpSessionSummary, requestCount: number): Promise<SessionShellProof> {
  await expect
    .poll(async () => {
      const state = await getSessionState();
      return { requestCount: state.session?.requestCount, sessionId: state.session?.sessionId };
    })
    .toEqual({ requestCount, sessionId: session.sessionId });

  const currentSession = (await getSessionState()).session;
  expect(currentSession).not.toBeNull();
  const headerTitle = page.getByTestId('agentic-chat-panel-header-title');
  await expect(headerTitle).toHaveText(currentSession!.title, { timeout: 30_000 });
  const messageList = page.getByTestId('agentic-virtual-message-list');
  await expect(messageList).toBeVisible({ timeout: 30_000 });
  const messageRows = page.getByTestId('agentic-message-row');
  await expect.poll(() => messageRows.count()).toBeGreaterThan(0);
  await expect.poll(() => messageRows.count()).toBeLessThanOrEqual(6);
  await expect(messageList.getByText(/Deep Thinking|深度思考/).last()).toBeVisible({ timeout: 30_000 });
  await expect(messageList.getByText(/Called (?:MCP )?Tool/).last()).toBeVisible({ timeout: 30_000 });
  await expect(sendButton()).toBeVisible({ timeout: 30_000 });
  await expect(chatSlot().getByRole('button', { name: /^(Stop|停止)$/i })).toBeHidden();

  const state = await getSessionState();
  return {
    activeSessionId: state.session?.sessionId,
    headerTitle: (await headerTitle.textContent()) || '',
    messageRows: await messageRows.count(),
    requestCount: state.session?.requestCount ?? 0,
    reasoningToggleCount: await messageList.getByText(/Deep Thinking|深度思考/).count(),
    toolCardCount: await messageList.getByText(/Called (?:MCP )?Tool/).count(),
    sendVisible: await sendButton().isVisible(),
    stopVisible: await chatSlot()
      .getByRole('button', { name: /^(Stop|停止)$/i })
      .isVisible()
      .catch(() => false),
  };
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
    await waitForSessionShell(sessionA, 1);
    await selectTask(sessionB.sessionId);
    await waitForSessionShell(sessionB, 1);

    await selectTask(sessionA.sessionId);
    await sendPromptAndWaitForResult(SESSION_A_PROMPT, sessionA.sessionId);
    const sessionAAfterSend = await waitForSessionShell(sessionA, 2);
    const sessionAProof = await evidence.saveJson(
      '01-session-a-complete',
      sessionAAfterSend,
      'Session A completed one deterministic history-backed turn',
    );

    await selectTask(sessionB.sessionId);
    const sessionBUnchanged = await waitForSessionShell(sessionB, 1);
    const emptySessionBProof = await evidence.saveJson(
      '02-session-b-empty-after-a',
      sessionBUnchanged,
      'Session B baseline stays unchanged after Session A receives updates',
    );

    await sendPromptAndWaitForResult(SESSION_B_PROMPT, sessionB.sessionId);
    const sessionBAfterSend = await waitForSessionShell(sessionB, 2);
    const sessionBProof = await evidence.saveJson(
      '03-session-b-complete',
      sessionBAfterSend,
      'Session B completed one deterministic history-backed turn',
    );

    await selectTask(sessionA.sessionId);
    const sessionARestored = await waitForSessionShell(sessionA, 2);

    await selectTask(sessionB.sessionId);
    const sessionBRestored = await waitForSessionShell(sessionB, 2);
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
