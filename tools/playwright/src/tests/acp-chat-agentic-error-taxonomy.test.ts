// Source: test/bdd/acp-chat-agentic-error-taxonomy.scenario.md
// Source: test/bdd/acp-chat-agentic-input-send.scenario.md
// Source: test/bdd/acp-error-and-recovery.scenario.md

import { type Locator, expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixture,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';

const FAILURE_TEST_TIMEOUT_MS = ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 2;
const CONFIG_SELECTOR = '[role="combobox"][class*="config_selector"]';
const STREAM_RECOVERY_PROMPT = 'BDD recovery smoke';

interface FailureUiSnapshot {
  chatText: string;
  notificationText: string;
  errorNotificationCount: number;
  infoNotificationCount: number;
  chatErrorCount: number;
  userRowCount: number;
  assistantRowCount: number;
  hasStackTrace: boolean;
  hasRawRpcPayload: boolean;
  hasSecretLikeText: boolean;
}

async function withFixture<T>(fixture: AcpBddFixture, run: (runtime: AcpBddFixtureRuntime) => Promise<T>) {
  const runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture,
    profile: 'interactive',
    delayMs: 20,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1800, height: 1000 },
  });

  try {
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
    return await run(runtime);
  } finally {
    await runtime.dispose();
  }
}

function chatSlot(): Locator {
  return page.locator('.AI-Chat-slot');
}

function chatInput(): Locator {
  return chatSlot().locator('[contenteditable="true"]').last();
}

function sendButton(): Locator {
  return chatSlot().getByRole('button', { name: 'Send' }).last();
}

function recoveryButton(): Locator {
  return chatSlot()
    .getByRole('button', { name: /Afresh|Regenerate|Retry|重新生成/i })
    .last();
}

function configSelectors(): Locator {
  return page.locator(CONFIG_SELECTOR);
}

async function sendPrompt(prompt: string) {
  await expect(chatInput()).toBeVisible();
  await chatInput().click();
  await page.keyboard.type(prompt);
  await expect(sendButton()).toBeVisible();
  await sendButton().click();
}

async function readSessionState() {
  return page.evaluate(async () => (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}));
}

async function readFailureUiSnapshot(): Promise<FailureUiSnapshot> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const visibleText = (selector: string) =>
      Array.from(document.querySelectorAll(selector))
        .filter(isVisible)
        .map((element) => element.textContent || '')
        .join('\n');

    const chatText = visibleText('.AI-Chat-slot');
    const notificationText = visibleText('.kt-notification-wrapper');
    const visibleTextToScan = `${chatText}\n${notificationText}`;

    return {
      chatText,
      notificationText,
      errorNotificationCount: Array.from(document.querySelectorAll('.kt-notification-error')).filter(isVisible).length,
      infoNotificationCount: Array.from(document.querySelectorAll('.kt-notification-info')).filter(isVisible).length,
      chatErrorCount: Array.from(document.querySelectorAll('.AI-Chat-slot .rce-ai-msg [class*="error"]')).filter(
        isVisible,
      ).length,
      userRowCount: Array.from(document.querySelectorAll('.AI-Chat-slot .rce-user-msg')).filter(isVisible).length,
      assistantRowCount: Array.from(document.querySelectorAll('.AI-Chat-slot .rce-ai-msg')).filter(isVisible).length,
      hasStackTrace: /\n\s*at\s+\S+\s+\(|\bat\s+\S+:\d+:\d+/.test(visibleTextToScan),
      hasRawRpcPayload: /"jsonrpc"|rawInput|rawOutput|session\/prompt|session\/new|session\/load/i.test(
        visibleTextToScan,
      ),
      hasSecretLikeText: /token=|api[_-]?key|password|sk-[a-z0-9]/i.test(visibleTextToScan),
    };
  });
}

async function expectSafeVisibleFailure(snapshot: FailureUiSnapshot) {
  expect(snapshot.hasStackTrace).toBe(false);
  expect(snapshot.hasRawRpcPayload).toBe(false);
  expect(snapshot.hasSecretLikeText).toBe(false);
}

async function expectInputRecovered() {
  await expect(sendButton()).toBeVisible({ timeout: 30_000 });
  await expect(chatInput()).toBeVisible();
  await expect(chatInput()).toBeEditable();
}

async function expectStreamRichRecovery(label: string) {
  await withFixture('stream-rich', async () => {
    await sendPrompt(STREAM_RECOVERY_PROMPT);

    await expect
      .poll(
        async () => {
          const state = await readSessionState();
          return {
            success: state.success,
            active: state.result?.active,
            requestCount: state.result?.session?.requestCount ?? 0,
            historyMessageCount: state.result?.session?.historyMessageCount ?? 0,
            rawSessionIdHasAcpPrefix: String(state.result?.session?.rawSessionId || '').startsWith('acp:'),
          };
        },
        { message: `stream-rich recovery did not settle after ${label}`, timeout: 30_000 },
      )
      .toMatchObject({
        success: true,
        active: true,
        requestCount: expect.any(Number),
        rawSessionIdHasAcpPrefix: false,
      });

    await expect.poll(async () => (await readSessionState()).result?.session?.requestCount ?? 0).toBeGreaterThan(0);
    await expectInputRecovered();

    const snapshot = await readFailureUiSnapshot();
    expect(snapshot.chatErrorCount).toBe(0);
    expect(snapshot.userRowCount).toBeGreaterThan(0);
    expect(snapshot.assistantRowCount).toBeGreaterThan(0);
    await expectSafeVisibleFailure(snapshot);
  });
}

async function selectFooterConfig(comboIndex: number, label: string) {
  const combo = configSelectors().nth(comboIndex);
  await expect(combo).toBeVisible();
  await combo.click();
  const option = page
    .locator('[role="option"]')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .first();
  await expect(option).toBeVisible();
  await option.click();
}

test.describe('ACP Chat Agentic Error Taxonomy and Recovery', () => {
  test.setTimeout(FAILURE_TEST_TIMEOUT_MS);

  test('Input and Send Recovery: send failure preserves user row and exposes retry', async () => {
    await withFixture('send-failure', async () => {
      await sendPrompt('BDD visible recovery case A');

      await expect
        .poll(async () => (await readFailureUiSnapshot()).userRowCount, { timeout: 30_000 })
        .toBeGreaterThan(0);
      await expect
        .poll(
          async () => {
            const snapshot = await readFailureUiSnapshot();
            return snapshot.chatErrorCount > 0 && /send|failure|error/i.test(snapshot.chatText);
          },
          { timeout: 30_000 },
        )
        .toBe(true);

      const snapshot = await readFailureUiSnapshot();
      expect(snapshot.chatErrorCount).toBeGreaterThan(0);
      expect(snapshot.userRowCount).toBeGreaterThan(0);
      await expect(recoveryButton()).toBeVisible();
      await expectInputRecovered();
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('send-failure');
  });

  test('Error Taxonomy: create failure leaves the draft input recoverable', async () => {
    await withFixture('create-failure', async () => {
      await sendPrompt('BDD visible recovery case B');

      await expect
        .poll(
          async () => {
            const snapshot = await readFailureUiSnapshot();
            return {
              errorNotificationCount: snapshot.errorNotificationCount,
              hasCreateFailureCategory: /create|session|failure|error/i.test(snapshot.notificationText),
            };
          },
          { timeout: 30_000 },
        )
        .toMatchObject({ errorNotificationCount: expect.any(Number), hasCreateFailureCategory: true });

      const snapshot = await readFailureUiSnapshot();
      expect(snapshot.errorNotificationCount).toBeGreaterThan(0);
      expect(snapshot.userRowCount).toBe(0);
      await expectInputRecovered();
      expect(await readSessionState()).toMatchObject({ success: true, result: { active: false } });
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('create-failure');
  });

  test('Recovery: load failure falls back to a usable draft from history selection', async () => {
    await withFixture('load-failure', async () => {
      const historyItem = page.getByText(/BDD History (alpha|beta)/).first();
      await expect(historyItem).toBeVisible({ timeout: 30_000 });
      await historyItem.click();

      await expect
        .poll(
          async () => {
            const snapshot = await readFailureUiSnapshot();
            const state = await readSessionState();
            return {
              hasRecoveryNotice: /history|new chat draft|session|not found|available/i.test(snapshot.notificationText),
              infoNotificationCount: snapshot.infoNotificationCount,
              active: state.result?.active,
            };
          },
          { timeout: 30_000 },
        )
        .toMatchObject({ hasRecoveryNotice: true, active: false });

      const snapshot = await readFailureUiSnapshot();
      expect(snapshot.infoNotificationCount).toBeGreaterThan(0);
      await expectInputRecovered();
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('load-failure');
  });

  test('Error Taxonomy: auth-required send failure is visible and retryable', async () => {
    await withFixture('auth-required', async () => {
      await sendPrompt('BDD visible recovery case C');

      await expect
        .poll(
          async () => {
            const snapshot = await readFailureUiSnapshot();
            return snapshot.chatErrorCount > 0 && /auth|required|sign.?in|login/i.test(snapshot.chatText);
          },
          { timeout: 30_000 },
        )
        .toBe(true);

      const snapshot = await readFailureUiSnapshot();
      expect(snapshot.chatErrorCount).toBeGreaterThan(0);
      expect(snapshot.userRowCount).toBeGreaterThan(0);
      await expect(recoveryButton()).toBeVisible();
      await expectInputRecovered();
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('auth-required');
  });

  test('Error Taxonomy: config failure keeps footer controls and input usable', async () => {
    await withFixture('config-failure', async () => {
      await expect.poll(async () => configSelectors().count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
      await selectFooterConfig(0, 'Chat');

      await expect
        .poll(
          async () => {
            const snapshot = await readFailureUiSnapshot();
            return {
              errorNotificationCount: snapshot.errorNotificationCount,
              hasConfigCategory: /config|failure|error/i.test(snapshot.notificationText),
            };
          },
          { timeout: 30_000 },
        )
        .toMatchObject({ errorNotificationCount: expect.any(Number), hasConfigCategory: true });

      const snapshot = await readFailureUiSnapshot();
      expect(snapshot.errorNotificationCount).toBeGreaterThan(0);
      await expect.poll(async () => configSelectors().count()).toBeGreaterThanOrEqual(4);
      await expectInputRecovered();
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('config-failure');
  });

  test.fixme('Error Taxonomy: disconnected agent recovery needs a deterministic process-exit fixture', async () => {});
});
