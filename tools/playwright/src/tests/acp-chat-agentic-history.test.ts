// Source: test/bdd/acp-chat-agentic-history.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const SESSION_PREFIX = 'bdd-history-seeded';
const SEEDED_RAW_SESSION_IDS = [`${SESSION_PREFIX}-alpha`, `${SESSION_PREFIX}-beta`];
const SEEDED_SESSION_IDS = SEEDED_RAW_SESSION_IDS.map((id) => `acp:${id}`);
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
  hasPendingPermission?: boolean;
}

interface HistoryRowProof {
  id: string;
  title: string;
  selected: boolean;
}

async function loadHistoryWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'history',
    profile: 'interactive',
    delayMs: 10,
    sessionPrefix: SESSION_PREFIX,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1600, height: 900 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const tools = await (navigator as any).modelContext.getTools();
          return tools.map((tool: { name: string }) => tool.name);
        }),
      { timeout: 30_000 },
    )
    .toContain('acp_chat_list_sessions');
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
          .map((session) => session.rawSessionId)
          .filter((id): id is string => !!id && SEEDED_RAW_SESSION_IDS.includes(id))
          .sort();
      },
      { timeout: 30_000 },
    )
    .toEqual([...SEEDED_RAW_SESSION_IDS].sort());

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

async function readHistoryRows(): Promise<HistoryRowProof[]> {
  await ensureHistoryVisible();
  return page.evaluate(() => {
    const isVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="chat-history-item-"]'))
      .filter(isVisible)
      .map((element) => {
        const id = element.getAttribute('data-testid')!.replace('chat-history-item-', '');
        const title = document.getElementById(`chat-history-item-title-${id}`)?.textContent?.trim() || '';
        return {
          id,
          title,
          selected: String(element.className).includes('selected'),
        };
      });
  });
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

async function clickNewChat() {
  await ensureHistoryVisible();
  await page
    .getByLabel(/New Chat|新建聊天/)
    .first()
    .click();
}

function expectMetadataOnly(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const sentinel of METADATA_LEAK_SENTINELS) {
    expect(serialized).not.toContain(sentinel);
  }
}

test.describe('ACP Chat Agentic History', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadHistoryWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('History lists seeded sessions and switches selection through metadata-only state', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-history', {
      sourceScenario: 'test/bdd/acp-chat-agentic-history.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const seededSessions = await waitForSeededSessions();
    const listProof = await evidence.saveJson(
      '01-list-sessions-seeded',
      { seededSessions },
      'history fixture sessions returned through acp_chat_list_sessions',
    );

    expect(seededSessions).toHaveLength(2);
    expect(seededSessions.map((session) => session.rawSessionId).sort()).toEqual([...SEEDED_RAW_SESSION_IDS].sort());
    expect(seededSessions.map((session) => session.title).sort()).toEqual(['BDD History alpha', 'BDD History beta']);
    seededSessions.forEach((session) => {
      expect(Object.keys(session).sort()).toEqual(
        expect.arrayContaining([
          'createdAt',
          'hasPendingPermission',
          'historyMessageCount',
          'rawSessionId',
          'requestCount',
          'sessionId',
          'slicedMessageCount',
          'threadStatus',
          'title',
        ]),
      );
    });
    expectMetadataOnly(seededSessions);

    const rows = await readHistoryRows();
    const seededRows = rows.filter((row) => SEEDED_SESSION_IDS.includes(row.id));
    const rowProof = await evidence.saveJson(
      '02-visible-history-rows',
      { rows },
      'visible Agentic history rows for deterministic sessions',
    );
    expect(seededRows.map((row) => row.id).sort()).toEqual([...SEEDED_SESSION_IDS].sort());
    expect(seededRows.map((row) => row.title).sort()).toEqual(['BDD History alpha', 'BDD History beta']);

    const expectedVisibleOrder = seededSessions.map((session) => session.sessionId);
    expect(rows.map((row) => row.id).filter((id) => SEEDED_SESSION_IDS.includes(id))).toEqual(expectedVisibleOrder);

    const [newerSession, olderSession] = seededSessions;
    await clickHistoryItem(olderSession.sessionId);
    let state = await getSessionState();
    expect(state).toMatchObject({
      active: true,
      session: {
        sessionId: olderSession.sessionId,
        rawSessionId: olderSession.rawSessionId,
        title: olderSession.title,
      },
    });

    await clickHistoryItem(newerSession.sessionId);
    state = await getSessionState();
    expect(state).toMatchObject({
      active: true,
      session: {
        sessionId: newerSession.sessionId,
        rawSessionId: newerSession.rawSessionId,
        title: newerSession.title,
      },
    });

    const switchedRows = await readHistoryRows();
    const selectedSeededRows = switchedRows.filter((row) => row.selected && SEEDED_SESSION_IDS.includes(row.id));
    expect(selectedSeededRows).toHaveLength(1);
    expect(selectedSeededRows[0].id).toBe(newerSession.sessionId);

    const stateAfterSwitching = await getSessionState();
    const sessionsAfterSwitching = await listSessions();
    expectMetadataOnly({ sessionsAfterSwitching, stateAfterSwitching });

    await clickNewChat();
    await expect
      .poll(
        async () => {
          const nextState = await getSessionState();
          return nextState.active;
        },
        { message: 'New Chat should enter inactive draft state before the next send', timeout: 30_000 },
      )
      .toBe(false);

    const sessionsAfterNewChat = await listSessions();
    const seededAfterNewChat = sessionsAfterNewChat.filter((session) => SEEDED_SESSION_IDS.includes(session.sessionId));
    const rowsAfterNewChat = await readHistoryRows();
    const draftProof = await evidence.saveJson(
      '03-new-chat-draft',
      {
        active: (await getSessionState()).active,
        seededAfterNewChat,
        visibleRows: rowsAfterNewChat,
      },
      'New Chat enters draft state without duplicating persisted empty history rows',
    );

    expect(seededAfterNewChat.map((session) => session.sessionId).sort()).toEqual([...SEEDED_SESSION_IDS].sort());
    expect(
      rowsAfterNewChat
        .map((row) => row.id)
        .filter((id) => SEEDED_SESSION_IDS.includes(id))
        .sort(),
    ).toEqual([...SEEDED_SESSION_IDS].sort());
    expect(rowsAfterNewChat.some((row) => row.title === 'New Session' || row.title === '(untitled)')).toBe(false);
    expectMetadataOnly({ sessionsAfterNewChat, stateAfterNewChat: await getSessionState() });

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'The history fixture exposes seeded sessions through acp_chat_list_sessions.',
      status: 'pass',
      evidence: [listProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Agentic history shows the deterministic seeded session ids and safe titles in session-list order.',
      status: 'pass',
      evidence: [rowProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Switching history items updates selected UI row and acp_chat_get_session_state.',
      status: 'pass',
      evidence: [rowProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement: 'New Chat enters draft state without creating duplicate empty history rows.',
      status: 'pass',
      evidence: [draftProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP5',
      requirement: 'Session state and list tools stay metadata-only after history switching and New Chat.',
      status: 'pass',
      evidence: [rowProof, draftProof].filter(Boolean) as string[],
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
