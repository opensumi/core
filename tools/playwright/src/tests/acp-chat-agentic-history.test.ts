// Source: test/bdd/acp-chat-agentic-session-archive-and-restore.scenario.md

import { type Frame, expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  aiNativeWorkbenchUrl,
  loadAcpBddFixtureWorkbench,
  waitForAcpChatReady,
  waitForWorkbenchReady,
  writeAiNativePanelLayoutSettings,
} from './utils/acp-bdd-fixture';
import { launchTaskInCurrentProject } from './utils/acp-task-list';
import { createBddEvidence } from './utils/bdd-evidence';

const SESSION_PREFIX = 'bdd-history-seeded';
const METADATA_LEAK_SENTINELS = [
  'BDD_ASSISTANT_PART',
  'BDD_THOUGHT_STEP',
  'BDD_TOOL_RESULT',
  'BDD_USER_TURN',
  'BDD_HISTORY_USER',
  'BDD_HISTORY_THOUGHT',
  'BDD_HISTORY_ASSISTANT',
  'BDD_HISTORY_TOOL_RESULT',
  'BDD_PERMISSION_ALLOWED',
  'BDD_PERMISSION_REJECTED',
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

interface SessionRowProof {
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

async function expectAgenticFourRegions() {
  await expect(page.getByTestId('agentic-session-list')).toBeVisible();
  await expect(page.getByTestId('agentic-chat-panel-header')).toBeVisible();
  const visibleWorkbench = page.locator('#main-horizontal-ai-agentic > #main-horizontal-agentic:visible');
  await expect(visibleWorkbench).toHaveCount(1);
  await expect(visibleWorkbench).toBeVisible();
  await expect(page.locator('#workbench-editor')).toBeVisible();
  await expect(page.locator('[data-viewlet-id="explorer"]')).toBeVisible();
}

async function readSessionRows(): Promise<SessionRowProof[]> {
  return page.evaluate(() => {
    const isVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="agentic-session-row-"]'))
      .filter(isVisible)
      .map((element) => {
        const id = element.getAttribute('data-testid')!.replace('agentic-session-row-', '');
        return {
          id,
          title: element.getAttribute('title') || '',
          selected: element.getAttribute('aria-current') === 'true',
        };
      });
  });
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
}

async function selectTaskWithoutNavigation(sessionId: string) {
  let mainFrameNavigations = 0;
  const onFrameNavigated = (frame: Frame) => {
    if (frame === page.mainFrame()) {
      mainFrameNavigations += 1;
    }
  };

  page.on('framenavigated', onFrameNavigated);
  try {
    await selectTask(sessionId);
  } finally {
    page.off('framenavigated', onFrameNavigated);
  }

  expect(mainFrameNavigations).toBe(0);
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

async function startTaskInCurrentProject() {
  const agentLabel = await launchTaskInCurrentProject(page);
  expect(agentLabel).toBeTruthy();
  await expect(chatInput()).toBeVisible();
}

async function sendTaskPrompt(title: string): Promise<AcpSessionSummary> {
  await chatInput().click();
  await page.keyboard.insertText(title);
  await sendButton().click();

  await expect
    .poll(async () => (await getSessionState()).session?.requestCount ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(1);
  const session = (await getSessionState()).session!;
  await expect(page.getByTestId(`agentic-session-row-${session.sessionId}`)).toBeVisible({ timeout: 30_000 });
  return session;
}

async function showClassicAcpChatView() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await waitForAcpChatReady(page);
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

  test('Session Browser keeps the Agentic workbench visible, filters ordered Sessions, and restores selection safely', async ({
    browser: _browser,
  }, testInfo) => {
    void _browser;
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-session-archive-and-restore', {
      sourceScenario: 'test/bdd/acp-chat-agentic-session-archive-and-restore.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await expectAgenticFourRegions();
    await expect(page.locator('[data-testid="acp-chat-history-inline"]')).toHaveCount(0);

    await startTaskInCurrentProject();
    const olderSession = await sendTaskPrompt('Session Browser older prompt');
    await startTaskInCurrentProject();
    const newerSession = await sendTaskPrompt('Session Browser newer prompt');

    expect(newerSession.sessionId).not.toBe(olderSession.sessionId);
    const orderedRows = await readSessionRows();
    const sessionRows = orderedRows.filter((row) => [olderSession.sessionId, newerSession.sessionId].includes(row.id));
    expect(sessionRows.map((row) => row.id)).toEqual([newerSession.sessionId, olderSession.sessionId]);

    const listProof = await evidence.saveJson(
      '01-session-browser-four-regions-and-order',
      { orderedRows, sessionRows },
      'Agent Session Browser remains visible with the chat, editor, and Explorer while Session rows are newest-first',
    );

    const search = page.getByPlaceholder('Search sessions');
    await search.fill(newerSession.title);
    await expect(page.getByTestId(`agentic-session-row-${newerSession.sessionId}`)).toBeVisible();
    await search.fill('prompt text must not be Session metadata');
    await expect(page.getByTestId(`agentic-session-row-${newerSession.sessionId}`)).toHaveCount(0);
    await expect(page.getByTestId(`agentic-session-row-${olderSession.sessionId}`)).toHaveCount(0);
    await search.fill('');

    await selectTaskWithoutNavigation(olderSession.sessionId);
    const rowsAfterSelection = await readSessionRows();
    expect(rowsAfterSelection.filter((row) => row.selected).map((row) => row.id)).toEqual([olderSession.sessionId]);

    await selectTask(newerSession.sessionId);
    await expect(page.getByTestId(`agentic-session-row-${newerSession.sessionId}`)).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.locator('[data-testid^="agentic-task-row-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="agentic-task-archive-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="agentic-task-status-"]')).toHaveCount(0);

    const archivedArea = page.getByTestId('agentic-archived-session-area');
    await expect(archivedArea).toHaveAttribute('data-expanded', 'false');
    const olderRow = page.getByTestId(`agentic-session-row-${olderSession.sessionId}`);
    await olderRow.hover();
    const archiveButton = page.getByTestId(`agentic-session-archive-${olderSession.sessionId}`);
    await expect(archiveButton).toBeVisible();
    await archiveButton.click();
    await expect(olderRow).toHaveCount(0);

    await archivedArea.getByRole('button', { name: 'Archived Sessions' }).click();
    await expect(archivedArea).toHaveAttribute('data-expanded', 'true');
    await expect(page.getByTestId(`agentic-session-row-${olderSession.sessionId}`)).toBeVisible();
    await expect(page.getByTestId(`agentic-session-unarchive-${olderSession.sessionId}`)).toBeVisible();
    await selectTaskWithoutNavigation(olderSession.sessionId);

    await page.reload();
    await waitForWorkbenchReady(page);
    await expect(page.getByTestId('agentic-session-list')).toBeVisible();
    await expect(page.getByTestId('agentic-chat-panel-header')).toBeVisible();
    await expect(page.getByTestId('agentic-archived-session-area')).toHaveAttribute('data-expanded', 'false');
    await expect(page.getByTestId(`agentic-session-row-${olderSession.sessionId}`)).toHaveCount(0);
    await page.getByTestId('agentic-archived-session-area').getByRole('button', { name: 'Archived Sessions' }).click();
    const restoredArchivedRow = page.getByTestId(`agentic-session-row-${olderSession.sessionId}`);
    await expect(restoredArchivedRow).toBeVisible({ timeout: 30_000 });
    await restoredArchivedRow.hover();
    await page.getByTestId(`agentic-session-unarchive-${olderSession.sessionId}`).click();
    await expect(page.getByTestId(`agentic-session-archive-${olderSession.sessionId}`)).toBeAttached();

    const sessionsAfterArchiveRoundTrip = await listSessions();
    expect(sessionsAfterArchiveRoundTrip.some((session) => session.sessionId === olderSession.sessionId)).toBe(true);
    const archiveEvidence = await evidence.saveJson(
      '02-session-archive-round-trip',
      {
        archivedSessionId: olderSession.sessionId,
        agentStillListsSession: sessionsAfterArchiveRoundTrip.some(
          (session) => session.sessionId === olderSession.sessionId,
        ),
      },
      'Local Archive survives reload, remains selectable, and does not remove the Agent-owned Session',
    );

    const stateAfterSelection = await getSessionState();
    const sessionsAfterSelection = await listSessions();
    expectMetadataOnly({ sessionsAfterSelection, stateAfterSelection });
    const safeEvidence = await evidence.saveJson(
      '03-session-browser-metadata-safety',
      { sessionsAfterSelection, stateAfterSelection },
      'Session Browser selection and ACP list/state tools exclude fixture prompt, assistant, thought, tool-result, and permission content sentinels',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Agentic keeps Session Browser, conversation, editor, and Explorer visible with newest-first rows.',
      status: 'pass',
      evidence: [listProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Session search filters Agent-owned metadata without matching prompt content.',
      status: 'pass',
      evidence: [listProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Same-project Session selection changes the active ACP session without a workspace reload.',
      status: 'pass',
      evidence: [listProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement: 'Archive and Unarchive move Agent-owned Sessions locally without closing or deleting them.',
      status: 'pass',
      evidence: [archiveEvidence].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP5',
      requirement: 'Session selection state and metadata-only ACP tools remain sentinel-free.',
      status: 'pass',
      evidence: [safeEvidence].filter(Boolean) as string[],
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

  test('Classic layout keeps ACP history behind its popover button', async () => {
    await writeAiNativePanelLayoutSettings(runtime.workspaceDir, 'classic');
    await page.goto(aiNativeWorkbenchUrl(runtime.workspaceDir, 'interactive', 'classic'));
    await waitForWorkbenchReady(page);
    await showClassicAcpChatView();

    const historyButton = page.getByTestId('acp-chat-history-button');
    await expect(historyButton).toBeVisible();
    await historyButton.click();
    await expect(page.getByTestId('acp-chat-history-popover')).toBeVisible();
  });
});
