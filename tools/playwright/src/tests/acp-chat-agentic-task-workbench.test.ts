// Source: test/bdd/acp-chat-agentic-task-workbench.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForAcpChatReady,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';
import { launchTaskInCurrentProject } from './utils/acp-task-list';
import { createBddEvidence } from './utils/bdd-evidence';

let runtime: AcpBddFixtureRuntime;

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

async function getSessionState(): Promise<{
  active: boolean;
  session: { sessionId: string; requestCount: number; threadStatus?: string } | null;
}> {
  const response = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  expect(response.success).toBe(true);
  return response.result;
}

async function createSession(prompt: string): Promise<string> {
  await launchTaskInCurrentProject(page);
  await expect(chatInput()).toBeVisible();
  await chatInput().click();
  await page.keyboard.insertText(prompt);
  await expect(chatInput()).toContainText(prompt);
  await expect(sendButton()).toBeEnabled({ timeout: 30_000 });
  await expect(sendButton()).toHaveAttribute('tabindex', '0', { timeout: 30_000 });
  await sendButton().click();
  await expect.poll(async () => (await getSessionState()).session?.requestCount, { timeout: 30_000 }).toBe(1);
  await expect(chatSlot().getByText('BDD_ASSISTANT_PART_2 completed.').last()).toBeVisible({ timeout: 30_000 });
  const sessionId = (await getSessionState()).session?.sessionId;
  expect(sessionId).toBeTruthy();
  const row = page.getByTestId(`agentic-session-row-${sessionId}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toHaveAttribute('aria-current', 'true');
  await expect(row).not.toContainText(prompt);
  return sessionId!;
}

async function selectSession(sessionId: string) {
  const row = page.getByTestId(`agentic-session-row-${sessionId}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect.poll(async () => (await getSessionState()).session?.sessionId, { timeout: 30_000 }).toBe(sessionId);
  await expect(row).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('acp-live-connecting')).toHaveCount(0, { timeout: 30_000 });
}

async function showAgenticChat() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await waitForAcpChatReady(page);
  await ensureAgenticLayout(page);
}

test.describe('ACP Chat Agent Session workbench', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'history',
      profile: 'interactive',
      delayMs: 10,
      sessionPrefix: 'bdd-session-workbench',
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('安全创建、切换并在重载后恢复 Agent-owned Sessions', async ({ browser: _browser }, testInfo) => {
    void _browser;
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-task-workbench', {
      sourceScenario: 'test/bdd/acp-chat-agentic-task-workbench.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await expect(page.getByTestId('agentic-session-list')).toBeVisible();
    await expect(page.getByPlaceholder('Search sessions')).toBeVisible();
    await expect(page.locator('[data-testid^="agentic-task-row-"]')).toHaveCount(0);

    const firstSessionId = await createSession('Current older');
    const secondSessionId = await createSession('Current newer');
    expect(secondSessionId).not.toBe(firstSessionId);

    await selectSession(firstSessionId);
    await expect(chatSlot().getByText('BDD_ASSISTANT_PART_2 completed.').last()).toBeVisible();
    await selectSession(secondSessionId);

    const beforeReload = await evidence.saveJson(
      '01-session-browser-switching',
      {
        firstSessionId,
        secondSessionId,
        visibleRows: await page.locator('[data-testid^="agentic-session-row-"]').count(),
        activeSessionId: (await getSessionState()).session?.sessionId,
        legacyTaskRows: await page.locator('[data-testid^="agentic-task-row-"]').count(),
      },
      'Agent-owned Session Browser creates and switches two sessions without legacy Task rows',
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await showAgenticChat();
    await selectSession(firstSessionId);
    const restoredUserMessage = chatSlot().locator('.rce-user-msg').filter({ hasText: 'Current older' });
    await expect(restoredUserMessage).toHaveCount(1);
    await expect(chatSlot().getByText('BDD_ASSISTANT_PART_2 completed.').last()).toBeVisible();

    const afterReload = await evidence.saveJson(
      '02-session-browser-reload',
      {
        restoredSessionId: (await getSessionState()).session?.sessionId,
        firstRowVisible: await page.getByTestId(`agentic-session-row-${firstSessionId}`).isVisible(),
        secondRowVisible: await page.getByTestId(`agentic-session-row-${secondSessionId}`).isVisible(),
        restoredUserMessageCount: await restoredUserMessage.count(),
      },
      'Agent discovery restores both rows and the original user turn after reload',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Session Browser uses Agent-owned Session rows rather than legacy Task metadata.',
      status: 'pass',
      evidence: [beforeReload].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Two sessions can be switched and restore their user and assistant turns after reload.',
      status: 'pass',
      evidence: [beforeReload, afterReload].filter(Boolean) as string[],
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
