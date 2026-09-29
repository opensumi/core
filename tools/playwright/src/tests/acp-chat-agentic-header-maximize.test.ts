// Source: test/bdd/acp-chat-agentic-header-maximize.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForExplorerViewVisible,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const SESSION_PREFIX = 'bdd-header-maximize';
const FIRST_PROMPT = 'Agentic maximize task';
const AGENT_SESSION_TITLE = 'BDD Turn 1';

let runtime: AcpBddFixtureRuntime;

interface RectProof {
  x: number;
  y: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

interface HeaderLayoutProof {
  viewport: {
    width: number;
    height: number;
  };
  headerTitle: string;
  activeSessionTitle?: string;
  activeSessionId?: string;
  maximizeVisible: boolean;
  maximizeWorkbenchVisibleState?: string | null;
  maximizeLabel?: string | null;
  maximizeIconClass?: string;
  explorerVisible: boolean;
  workbenchVisible: boolean;
  editorVisible: boolean;
  fatalTextVisible: boolean;
  aiChat?: RectProof;
  workbench?: RectProof;
  explorer?: RectProof;
  editor?: RectProof;
}

async function executeAcpTool<T>(name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ toolName, toolArgs }) => (navigator as any).modelContext.executeTool(toolName, toolArgs),
    { toolName: name, toolArgs: args },
  ) as Promise<{ success: boolean; result: T }>;
}

async function getSessionState() {
  const result = await executeAcpTool<{
    active: boolean;
    session: {
      sessionId: string;
      rawSessionId?: string;
      title?: string;
      requestCount: number;
    } | null;
  }>('acp_chat_get_session_state');
  expect(result.success).toBe(true);
  return result.result;
}

async function createActiveTask(): Promise<string> {
  const header = page.getByTestId('agentic-chat-panel-header');
  const launcher = header.getByTestId('agentic-task-launch-button');
  await expect(launcher).toHaveCount(1);
  await launcher.click();
  await expect(header.getByTestId('agentic-task-agent-menu')).toHaveCount(0);

  const input = page.locator('.AI-Chat-slot [contenteditable="true"]');
  await expect(input).toHaveCount(1);
  await input.click();
  await page.keyboard.insertText(FIRST_PROMPT);

  const send = page.locator('.AI-Chat-slot').getByRole('button', { name: 'Send', exact: true });
  await expect(send).toHaveCount(1);
  await send.click();

  await expect
    .poll(
      async () => {
        const requestCount = (await getSessionState()).session?.requestCount ?? 0;
        if (requestCount === 0 && (await input.textContent())?.includes(FIRST_PROMPT)) {
          await send.click();
        }
        return requestCount;
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(1);

  const session = (await getSessionState()).session!;
  const row = page.getByTestId(`agentic-session-row-${session.sessionId}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toHaveAttribute('aria-label', AGENT_SESSION_TITLE);
  return session.sessionId;
}

async function readHeaderLayoutProof(): Promise<HeaderLayoutProof> {
  const state = await getSessionState();

  return page.evaluate((sessionState) => {
    const toRect = (rect: DOMRect): RectProof => ({
      x: rect.x,
      y: rect.y,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    });
    const isVisible = (element: Element | null | undefined) => {
      if (!element) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const firstVisible = (selectors: string[]) =>
      selectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .find((element) => isVisible(element));

    const aiChat = document.querySelector('.AI-Chat-slot');
    const workbench = document.querySelector('#workbench-editor');
    const explorer = firstVisible(['[data-viewlet-id="explorer"]', '#opensumi-left-tabbar li#explorer']);
    const editor = firstVisible(['.monaco-editor', '#workbench-editor']);
    const titleElement = firstVisible([
      '[data-testid="agentic-chat-panel-header-title"]',
      '.AI-Chat-slot [class*="chat_history_header_title"] span',
      '.AI-Chat-slot [data-testid="acp-chat-history"]',
    ]);
    const maximizeWrapper = document.querySelector('#agentic-chat-panel-header-maximize');
    const maximizeAction = firstVisible(['#agentic-chat-panel-header-maximize [role="button"]']);
    const maximizeIcon = maximizeWrapper?.querySelector('.kt-icon');
    const visibleText = document.body.innerText || '';

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      headerTitle: titleElement?.textContent?.trim() || '',
      activeSessionTitle: sessionState.session?.title,
      activeSessionId: sessionState.session?.sessionId,
      maximizeVisible: isVisible(maximizeAction),
      maximizeWorkbenchVisibleState: maximizeWrapper?.getAttribute('data-workbench-visible'),
      maximizeLabel: maximizeAction?.getAttribute('aria-label'),
      maximizeIconClass: maximizeIcon?.className.toString(),
      explorerVisible: isVisible(explorer),
      workbenchVisible: isVisible(workbench),
      editorVisible: isVisible(editor),
      fatalTextVisible: /SERVICE_UNAVAILABLE|EXECUTION_ERROR|Initializing ACP service|uncaught|stack trace/i.test(
        visibleText,
      ),
      aiChat: aiChat && isVisible(aiChat) ? toRect(aiChat.getBoundingClientRect()) : undefined,
      workbench: workbench && isVisible(workbench) ? toRect(workbench.getBoundingClientRect()) : undefined,
      explorer: explorer && isVisible(explorer) ? toRect(explorer.getBoundingClientRect()) : undefined,
      editor: editor && isVisible(editor) ? toRect(editor.getBoundingClientRect()) : undefined,
    };
  }, state);
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
  await waitForExplorerViewVisible(page);
}

test.describe('ACP Chat Agentic Header Maximize', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadHistoryWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('Header title remains visible and maximize toggles the Agentic workbench', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-header-maximize', {
      sourceScenario: 'test/bdd/acp-chat-agentic-header-maximize.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const activeSessionId = await createActiveTask();
    await ensureAgenticLayout(page);

    const before = await readHeaderLayoutProof();
    expect(before.activeSessionId).toBe(activeSessionId);
    expect(before.activeSessionTitle).toBe(AGENT_SESSION_TITLE);
    expect(before.headerTitle).toBe(AGENT_SESSION_TITLE);
    expect(before.maximizeVisible).toBe(true);
    expect(before.maximizeWorkbenchVisibleState).toBe('true');
    expect(before.maximizeLabel).toBe('Focus AI Chat');
    expect(before.maximizeIconClass || '').toContain('kticon-fullescreen');
    expect(before.workbenchVisible).toBe(true);
    expect(before.explorerVisible).toBe(true);
    expect(before.aiChat?.width).toBeGreaterThanOrEqual(640);
    const beforeProof = await evidence.saveJson(
      '01-before-maximize',
      before,
      'Agentic chat header title and workbench geometry before maximize',
    );

    const maximizeAction = page.locator('#agentic-chat-panel-header-maximize [role="button"]');
    await expect(maximizeAction).toHaveCount(1);
    await expect(maximizeAction).toHaveAttribute('aria-label', 'Focus AI Chat');
    await maximizeAction.click();
    await expect(maximizeAction).toHaveAttribute('aria-label', 'Restore editor and Explorer');
    await expect(page.getByTestId('agentic-chat-panel-header-title')).toHaveText(AGENT_SESSION_TITLE);

    const after = await readHeaderLayoutProof();
    expect(after.activeSessionId).toBe(activeSessionId);
    expect(after.activeSessionTitle).toBe(AGENT_SESSION_TITLE);
    expect(after.headerTitle).toBe(AGENT_SESSION_TITLE);
    expect(after.maximizeVisible).toBe(true);
    expect(after.maximizeWorkbenchVisibleState).toBe('false');
    expect(after.maximizeLabel).toBe('Restore editor and Explorer');
    expect(after.maximizeIconClass || '').toContain('kticon-unfullscreen');
    expect(after.workbenchVisible).toBe(false);
    expect(after.editorVisible).toBe(false);
    expect(after.explorerVisible).toBe(false);
    expect(after.aiChat?.width).toBeGreaterThan((before.aiChat?.width || 0) + 200);
    expect(after.aiChat?.right).toBeLessThanOrEqual(after.viewport.width + 2);
    expect(after.fatalTextVisible).toBe(false);
    const afterProof = await evidence.saveJson(
      '02-after-maximize',
      after,
      'Agentic chat remains visible while workbench and Explorer are collapsed after maximize',
    );

    await maximizeAction.click();
    await expect(maximizeAction).toHaveAttribute('aria-label', 'Focus AI Chat');
    await ensureAgenticLayout(page);
    await expect(page.getByTestId('agentic-chat-panel-header-title')).toHaveText(AGENT_SESSION_TITLE);

    const restored = await readHeaderLayoutProof();
    expect(restored.activeSessionId).toBe(activeSessionId);
    expect(restored.activeSessionTitle).toBe(AGENT_SESSION_TITLE);
    expect(restored.headerTitle).toBe(AGENT_SESSION_TITLE);
    expect(restored.maximizeVisible).toBe(true);
    expect(restored.maximizeWorkbenchVisibleState).toBe('true');
    expect(restored.maximizeLabel).toBe('Focus AI Chat');
    expect(restored.maximizeIconClass || '').toContain('kticon-fullescreen');
    expect(restored.workbenchVisible).toBe(true);
    expect(restored.editorVisible).toBe(true);
    expect(restored.explorerVisible).toBe(true);
    const restoredProof = await evidence.saveJson(
      '03-after-restore',
      restored,
      'Agentic workbench, editor, and Explorer return after clicking the header restore action',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'The chat header shows the active ACP session title from metadata.',
      status: 'pass',
      evidence: [beforeProof, afterProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'The Agentic header action switches from maximize to restore after the workbench collapses.',
      status: 'pass',
      evidence: [beforeProof, afterProof, restoredProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement:
        'Clicking maximize leaves AI Chat visible and hides workbench, editor, and Explorer/file tree; clicking restore brings them back.',
      status: 'pass',
      evidence: [beforeProof, afterProof, restoredProof].filter(Boolean) as string[],
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
