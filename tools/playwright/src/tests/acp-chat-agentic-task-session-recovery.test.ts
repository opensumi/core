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

test.describe('ACP Chat Agentic Task Session Recovery', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 2);

  test('keeps a retained Task visible and retryable when its originating Agent reports the Session missing', async () => {
    let missingLoadAttempts = 0;
    page.on('console', (message) => {
      if (message.type() === 'warning' && message.text().includes('AIBackSerivcePath:loadAgentSession')) {
        missingLoadAttempts += 1;
      }
    });
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

      const createdRow = page.locator('[data-testid^="agentic-task-row-"]').filter({ hasText: TASK_PROMPT }).first();
      await expect(createdRow).toBeVisible({ timeout: 30_000 });
      const rowTestId = await createdRow.getAttribute('data-testid');
      expect(rowTestId).toBeTruthy();
      const sessionId = rowTestId!.replace('agentic-task-row-', '');

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

      const retainedRow = page.getByTestId(`agentic-task-row-${sessionId}`);
      await expect(retainedRow).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId(`agentic-task-agent-${sessionId}`)).toContainText('claude-agent-acp');

      await chatInput().click();
      await page.keyboard.type(PREVIOUS_ACTIVE_PROMPT);
      await chatSlot().getByRole('button', { name: 'Send' }).last().click();
      await expect(chatSlot().getByText('BDD_ASSISTANT_PART_2 completed.')).toBeVisible({ timeout: 30_000 });
      const previousActiveRow = page
        .locator('[data-testid^="agentic-task-row-"]')
        .filter({ hasText: PREVIOUS_ACTIVE_PROMPT })
        .first();
      await expect(previousActiveRow).toHaveAttribute('aria-current', 'true');
      await page.waitForTimeout(250);

      await retainedRow.click();
      const unavailable = page.getByTestId(`agentic-task-availability-${sessionId}`);
      await expect(unavailable).toHaveText('History unavailable', { timeout: 30_000 });
      await expect(retainedRow).not.toHaveAttribute('aria-current', 'true');
      await expect(previousActiveRow).toHaveAttribute('aria-current', 'true');
      await expect.poll(() => missingLoadAttempts).toBeGreaterThanOrEqual(1);

      await retainedRow.click();
      await expect(unavailable).toHaveText('History unavailable');
      await expect.poll(() => missingLoadAttempts).toBeGreaterThanOrEqual(2);
      await expect(previousActiveRow).toHaveAttribute('aria-current', 'true');

      const visibleText = `${await chatSlot().innerText()}\n${await page
        .locator('.kt-notification-wrapper')
        .innerText()}`;
      expect(visibleText).not.toMatch(
        /\n\s*at\s+\S+\s+\(|"jsonrpc"|session\/load|api[_-]?key|password|\bsk-[a-z0-9]{8,}/i,
      );
    } finally {
      await runtime.dispose();
    }
  });
});
