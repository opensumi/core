// Source: test/bdd/acp-chat-agentic-task-session-recovery.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  clearAcpBddTransientSessionState,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForAcpChatReady,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';

const TASK_PROMPT = 'BDD missing Task Conversation';
const PREVIOUS_ACTIVE_PROMPT = 'BDD previous Active Task';

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

async function getActiveSessionId(): Promise<string | undefined> {
  const state = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  return state?.result?.session?.sessionId;
}

test.describe('ACP Chat Agentic Task Session Recovery', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 2);

  test('omits a Session that the originating Agent no longer returns and keeps the draft usable', async () => {
    const runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'task-session-missing',
      profile: 'interactive',
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });

    try {
      await chatInput().click();
      await page.keyboard.type(TASK_PROMPT);
      await chatSlot().getByRole('button', { name: 'Send' }).last().click();
      await expect(chatSlot().getByText('BDD_ASSISTANT_PART_2 completed.')).toBeVisible({ timeout: 30_000 });

      const sessionId = await getActiveSessionId();
      expect(sessionId).toBeTruthy();

      await page.waitForTimeout(250);
      await clearAcpBddTransientSessionState(page);
      await page.goto(runtime.url);
      await waitForWorkbenchReady(page);
      await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));
      await page.evaluate(async () => {
        await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
      });
      await waitForAcpChatReady(page);
      await ensureAgenticLayout(page);

      const retainedRow = page.getByTestId(`agentic-session-row-${sessionId}`);
      await expect(retainedRow).toHaveCount(0, { timeout: 30_000 });
      await expect(chatInput()).toBeVisible();
      await expect(chatInput()).toBeEditable();

      await chatInput().click();
      await page.keyboard.type(PREVIOUS_ACTIVE_PROMPT);
      await chatSlot().getByRole('button', { name: 'Send' }).last().click();
      await expect(chatSlot().getByText('BDD_ASSISTANT_PART_2 completed.')).toBeVisible({ timeout: 30_000 });
      const previousActiveSessionId = await getActiveSessionId();
      expect(previousActiveSessionId).toBeTruthy();
      expect(previousActiveSessionId).not.toBe(sessionId);
      await expect(retainedRow).toHaveCount(0);

      const notificationText = (await page.locator('.kt-notification-wrapper:visible').allInnerTexts()).join('\n');
      const visibleText = `${await chatSlot().innerText()}\n${notificationText}`;
      expect(visibleText).not.toMatch(
        /\n\s*at\s+\S+\s+\(|"jsonrpc"|session\/load|api[_-]?key|password|\bsk-[a-z0-9]{8,}/i,
      );
    } finally {
      await runtime.dispose();
    }
  });
});
