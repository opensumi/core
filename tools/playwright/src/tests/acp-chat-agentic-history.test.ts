// Source: test/bdd/acp-chat-agentic-history.scenario.md

import { expect, type Frame } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  aiNativeWorkbenchUrl,
  type AcpBddFixtureRuntime,
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

interface TaskRowProof {
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
  await expect(page.getByTestId('agentic-task-list')).toBeVisible();
  await expect(page.getByTestId('agentic-chat-panel-header')).toBeVisible();
  await expect(page.locator('#main-horizontal-agentic')).toBeVisible();
  await expect(page.locator('#workbench-editor')).toBeVisible();
  await expect(page.locator('[data-viewlet-id="explorer"]')).toBeVisible();
}

async function readTaskRows(): Promise<TaskRowProof[]> {
  return page.evaluate(() => {
    const isVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="agentic-task-row-"]'))
      .filter(isVisible)
      .map((element) => {
        const id = element.getAttribute('data-testid')!.replace('agentic-task-row-', '');
        return {
          id,
          title: element.getAttribute('title') || '',
          selected: element.getAttribute('aria-current') === 'true',
        };
      });
  });
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
  await expect.poll(async () => (await getSessionState()).active, { timeout: 30_000 }).toBe(false);
}

async function sendTaskPrompt(title: string): Promise<AcpSessionSummary> {
  await chatInput().click();
  await page.keyboard.insertText(title);
  await sendButton().click();

  await expect.poll(async () => (await getSessionState()).session, { timeout: 30_000 }).not.toBeNull();
  const session = (await getSessionState()).session!;
  await expect(page.getByTestId(`agentic-task-row-${session.sessionId}`)).toBeVisible({ timeout: 30_000 });
  return session;
}

async function refreshTaskList() {
  const search = page.getByPlaceholder('Search tasks');
  await search.fill('Task List');
  await search.fill('');
}

async function readPersistedTaskRegistryEvidence() {
  return page.evaluate(() => {
    const globalRecentData = window.localStorage.getItem('global:recent');
    if (!globalRecentData) {
      return undefined;
    }
    const globalRecent = JSON.parse(globalRecentData) as Record<string, unknown>;
    return {
      globalRecent,
      taskRegistry: globalRecent['agentic.task-registry.v2'],
    };
  });
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

  test('Task List keeps the Agentic workbench visible, filters ordered Tasks, and restores selection safely', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-history', {
      sourceScenario: 'test/bdd/acp-chat-agentic-history.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await expectAgenticFourRegions();
    await expect(page.locator('[data-testid="acp-chat-history-inline"]')).toHaveCount(0);

    await startTaskInCurrentProject();
    const olderTask = await sendTaskPrompt('Task List older immutable title');
    await startTaskInCurrentProject();
    const newerTask = await sendTaskPrompt('Task List newer immutable title');
    await refreshTaskList();

    const orderedRows = await readTaskRows();
    const taskRows = orderedRows.filter((row) => [olderTask.sessionId, newerTask.sessionId].includes(row.id));
    expect(taskRows.map((row) => row.id)).toEqual([newerTask.sessionId, olderTask.sessionId]);

    const listProof = await evidence.saveJson(
      '01-task-list-four-regions-and-order',
      { orderedRows, taskRows },
      'Agentic Task List remains visible with the chat, editor, and Explorer while Task rows are newest-first',
    );

    const search = page.getByPlaceholder('Search tasks');
    await search.fill('newer immutable');
    await expect(page.getByTestId(`agentic-task-row-${newerTask.sessionId}`)).toBeVisible();
    await expect(page.getByTestId(`agentic-task-row-${olderTask.sessionId}`)).toHaveCount(0);
    await search.fill('');

    await selectTaskWithoutNavigation(olderTask.sessionId);
    const rowsAfterSelection = await readTaskRows();
    expect(rowsAfterSelection.filter((row) => row.selected).map((row) => row.id)).toEqual([olderTask.sessionId]);

    await selectTask(newerTask.sessionId);
    await expect(page.getByTestId(`agentic-task-archive-${newerTask.sessionId}`)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId(`agentic-task-archive-${newerTask.sessionId}`).click();
    await expect(page.getByTestId(`agentic-task-row-${newerTask.sessionId}`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Archived Tasks' }).click();
    await expect(page.getByTestId(`agentic-task-unarchive-${newerTask.sessionId}`)).toBeVisible();
    await page.getByTestId(`agentic-task-unarchive-${newerTask.sessionId}`).click();
    await expect(page.getByTestId(`agentic-task-row-${newerTask.sessionId}`)).toBeVisible();

    const stateAfterSelection = await getSessionState();
    const sessionsAfterSelection = await listSessions();
    await expect
      .poll(async () => (await readPersistedTaskRegistryEvidence())?.taskRegistry, { timeout: 30_000 })
      .toBeTruthy();
    const persistedEvidence = await readPersistedTaskRegistryEvidence();
    expect(typeof persistedEvidence?.taskRegistry).toBe('string');
    const persistedTaskRegistry = JSON.parse(persistedEvidence!.taskRegistry as string);
    expect(persistedTaskRegistry.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionId: olderTask.sessionId }),
        expect.objectContaining({ sessionId: newerTask.sessionId }),
      ]),
    );
    expectMetadataOnly({ persistedEvidence, persistedTaskRegistry, sessionsAfterSelection, stateAfterSelection });
    const safeEvidence = await evidence.saveJson(
      '02-task-list-metadata-and-storage-safety',
      { persistedEvidence, persistedTaskRegistry, sessionsAfterSelection, stateAfterSelection },
      'Task List selection and the actual GLOBAL_RECENT_DATA task registry exclude fixture prompt, assistant, thought, tool-result, and permission content sentinels',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Agentic keeps Task List, conversation, editor, and Explorer visible with newest-first Task rows.',
      status: 'pass',
      evidence: [listProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Task search filters immutable titles without showing nonmatching Task rows.',
      status: 'pass',
      evidence: [listProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Same-project Task selection changes the active ACP session without a workspace reload.',
      status: 'pass',
      evidence: [listProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement: 'A ready Task can be archived and restored from Archived Tasks.',
      status: 'pass',
      evidence: [safeEvidence].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP5',
      requirement: 'Task selection state, session metadata, and browser persisted evidence remain sentinel-free.',
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
