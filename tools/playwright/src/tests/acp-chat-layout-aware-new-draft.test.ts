// Source: test/bdd/acp-chat-layout-aware-new-draft.scenario.md

import { expect } from '@playwright/test';

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

let runtime: AcpBddFixtureRuntime;

async function getSessionState(): Promise<{ active: boolean; session: { sessionId: string } | null }> {
  const result = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  expect(result.success).toBe(true);
  return result.result;
}

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

async function pressNewDraftShortcut(): Promise<void> {
  const isMac = await page.evaluate(() => /Mac/.test(navigator.platform));
  await page.keyboard.press(`${isMac ? 'Meta' : 'Control'}+Alt+N`);
}

async function focusEditor(): Promise<void> {
  const editorSurface = page.locator('#workbench-editor');
  await expect(editorSurface).toBeVisible({ timeout: 30_000 });
  await editorSurface.evaluate((element) => {
    element.setAttribute('tabindex', '-1');
    element.focus();
  });
  await expect(editorSurface).toBeFocused();
}

async function showAcpChat(): Promise<void> {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await waitForAcpChatReady(page);
}

test.describe('ACP Chat layout-aware New Draft actions', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'history',
      profile: 'interactive',
      panelLayout: 'agentic',
      delayMs: 10,
      sessionPrefix: 'bdd-layout-aware-new-draft',
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('uses direct New Task in Agentic and direct New Chat in Classic/IDE', async () => {
    const header = page.getByTestId('agentic-chat-panel-header');
    const primary = header.getByTestId('agentic-task-launch-button');
    const dropdown = header.getByTestId('agentic-task-agent-menu-button');

    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute('aria-label', /New Task with .+N/);
    await expect(dropdown).toHaveAttribute('aria-label', 'Choose Agent');

    const input = chatInput();
    await input.click();
    await page.keyboard.insertText('preserved Agentic draft');
    expect((await getSessionState()).active).toBe(true);
    await primary.click();
    await expect(header.getByTestId('agentic-task-agent-menu')).toHaveCount(0);
    await expect(input).toContainText('preserved Agentic draft');
    await expect(input).toBeFocused();
    expect((await getSessionState()).active).toBe(false);

    await dropdown.click();
    const menu = header.getByTestId('agentic-task-agent-menu');
    await expect(menu).toBeVisible();
    await menu.locator('[data-testid^="agentic-task-agent-option-"]').first().click();
    await expect(menu).toBeHidden();
    await expect(input).toContainText('preserved Agentic draft');
    await expect(input).toBeFocused();
    expect((await getSessionState()).active).toBe(false);

    await focusEditor();
    await pressNewDraftShortcut();
    await expect(input).toBeFocused();
    await expect(header.getByTestId('agentic-task-agent-menu')).toHaveCount(0);
    expect((await getSessionState()).active).toBe(false);

    await writeAiNativePanelLayoutSettings(runtime.workspaceDir, 'classic');
    await page.goto(aiNativeWorkbenchUrl(runtime.workspaceDir, 'interactive', 'classic'), {
      waitUntil: 'domcontentloaded',
    });
    await waitForWorkbenchReady(page);
    await showAcpChat();

    await expect(page.getByTestId('acp-chat-history-button')).toBeVisible();
    await expect(page.getByTestId('agentic-task-agent-menu-button')).toHaveCount(0);
    const classicInput = chatInput();
    await classicInput.click();
    await page.keyboard.insertText('preserved Classic draft');
    await expect(classicInput).toContainText('preserved Classic draft');
    await page.getByLabel('New Chat', { exact: true }).click();
    await expect(classicInput).toContainText('preserved Classic draft');
    await expect(classicInput).toBeFocused();
    await page.getByLabel('Close', { exact: true }).click();
    await expect(chatSlot()).toBeHidden();

    await showAcpChat();
    await expect(classicInput).toContainText('preserved Classic draft');
    await page.getByLabel('Close', { exact: true }).click();
    await expect(chatSlot()).toBeHidden();

    await focusEditor();
    await pressNewDraftShortcut();
    await expect(chatSlot()).toBeVisible();
    await expect(classicInput).toContainText('preserved Classic draft');
    await expect(classicInput).toBeFocused();
    expect((await getSessionState()).active).toBe(false);
  });
});
