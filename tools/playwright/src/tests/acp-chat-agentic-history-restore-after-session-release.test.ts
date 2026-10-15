// Source: test/bdd/acp-chat-agentic-history-restore-after-session-release.scenario.md

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
import { launchTaskInCurrentProject } from './utils/acp-task-list';

const RELEASED_TASK_PROMPT = 'BDD released Task history';
const PREVIOUS_ACTIVE_PROMPT = 'BDD previous Active Task after release';
const LOAD_FALLBACK_MESSAGE = 'Unable to open this task history. The previous Task remains active.';

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

async function getActiveSessionId(): Promise<string | undefined> {
  const result = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  expect(result.success).toBe(true);
  return result.result.session?.sessionId;
}

async function getActiveRequestCount(): Promise<number> {
  const result = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  expect(result.success).toBe(true);
  return result.result.session?.requestCount ?? 0;
}

async function notificationText(): Promise<string> {
  return (await page.locator('.kt-notification-wrapper').allInnerTexts()).join('\n');
}

async function showAgenticChat() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await waitForAcpChatReady(page);
  await ensureAgenticLayout(page);
}

async function launchAndCompleteTask(prompt: string): Promise<string> {
  await launchTaskInCurrentProject(page);
  await expect(chatInput()).toBeVisible();
  await chatInput().click();
  await page.keyboard.type(prompt);
  const send = sendButton();
  await send.click();
  await expect
    .poll(
      async () => {
        const requestCount = await getActiveRequestCount();
        if (requestCount === 0 && (await chatInput().textContent())?.includes(prompt)) {
          await send.click();
        }
        return requestCount;
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(1);
  await expect(chatSlot().getByText('BDD_ASSISTANT_PART_2 completed.').last()).toBeVisible({ timeout: 30_000 });

  const sessionId = await getActiveSessionId();
  expect(sessionId).toBeTruthy();
  const row = page.getByTestId(`agentic-session-row-${sessionId}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect.poll(getActiveSessionId, { timeout: 30_000 }).toBe(sessionId);
  await expect(row).toHaveAttribute('aria-current', 'true');
  return sessionId!;
}

test.describe('ACP Chat Agentic history restore after backend session release', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 2);

  test('restores history before attaching and activates the retained Task', async () => {
    const runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'history',
      profile: 'interactive',
      forceAcpAttachmentFailure: true,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });

    try {
      const releasedSessionId = await launchAndCompleteTask(RELEASED_TASK_PROMPT);
      const releasedRow = page.getByTestId(`agentic-session-row-${releasedSessionId}`);
      await expect(releasedRow).toHaveAttribute('aria-current', 'true');

      await page.evaluate(async () => {
        const disposeAcpSessions = (window as any).__OPENSUMI_E2E__?.disposeAcpSessions;
        if (typeof disposeAcpSessions !== 'function') {
          throw new Error('OpenSumi E2E ACP session release hook is unavailable');
        }
        await disposeAcpSessions();
      });
      await clearAcpBddTransientSessionState(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForWorkbenchReady(page);
      await showAgenticChat();

      const retainedRow = page.getByTestId(`agentic-session-row-${releasedSessionId}`);
      await expect(retainedRow).toBeVisible({ timeout: 30_000 });

      const previousActiveSessionId = await launchAndCompleteTask(PREVIOUS_ACTIVE_PROMPT);
      const previousActiveRow = page.getByTestId(`agentic-session-row-${previousActiveSessionId}`);
      await expect(previousActiveRow).toHaveAttribute('aria-current', 'true');

      await retainedRow.click();
      await expect.poll(getActiveSessionId, { timeout: 30_000 }).toBe(releasedSessionId);
      await expect(retainedRow).toHaveAttribute('aria-current', 'true');
      await expect(previousActiveRow).not.toHaveAttribute('aria-current', 'true');
      await expect(chatSlot().getByText('Restored Task context')).toBeVisible({ timeout: 30_000 });
      await expect(chatSlot().getByText('Restored Task response, part two.')).toBeVisible({ timeout: 30_000 });
      await expect(sendButton()).toBeVisible();

      const restoredUserRows = await chatSlot().locator('.rce-user-msg').count();
      const restoredAssistantRows = await chatSlot().locator('.rce-ai-msg').count();
      expect(restoredUserRows).toBe(1);
      expect(restoredAssistantRows).toBeGreaterThanOrEqual(1);

      expect(await notificationText()).not.toContain(LOAD_FALLBACK_MESSAGE);

      await retainedRow.click();
      await expect.poll(getActiveSessionId).toBe(releasedSessionId);
      await expect(chatSlot().locator('.rce-user-msg')).toHaveCount(restoredUserRows);
      await expect(chatSlot().locator('.rce-ai-msg')).toHaveCount(restoredAssistantRows);
      expect(await notificationText()).not.toContain(LOAD_FALLBACK_MESSAGE);

      const visibleText = `${await chatSlot().innerText()}\n${await notificationText()}`;
      expect(visibleText).not.toMatch(
        /\n\s*at\s+\S+\s+\(|"jsonrpc"|session\/load|api[_-]?key|password|\bsk-[a-z0-9]{8,}/i,
      );
    } finally {
      await runtime.dispose();
    }
  });
});
