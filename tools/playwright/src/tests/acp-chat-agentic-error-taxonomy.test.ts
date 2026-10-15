// Source: test/bdd/acp-chat-agentic-error-taxonomy.scenario.md
// Source: test/bdd/acp-chat-agentic-input-send.scenario.md
// Source: test/bdd/acp-error-and-recovery.scenario.md

import { type Locator, expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixture,
  type AcpBddFixtureOptions,
  type AcpBddFixtureRuntime,
  clearAcpBddTransientSessionState,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForAcpChatReady,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';

const FAILURE_TEST_TIMEOUT_MS = ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 2;
const CONFIG_SELECTOR = '[role="combobox"][class*="config_selector"]';
const STREAM_RECOVERY_PROMPT = 'BDD recovery smoke';
const LOAD_FAILURE_SESSION_PREFIX = 'bdd-load-failure-history';
const LOAD_FAILURE_SESSION_IDS = [
  `acp:${LOAD_FAILURE_SESSION_PREFIX}-alpha`,
  `acp:${LOAD_FAILURE_SESSION_PREFIX}-beta`,
];
const DISCONNECTED_AGENT_ERROR_PATTERN =
  /agent.*(disconnect|closed|exit|stopped|terminated)|disconnect|connection.*closed|closed.*connection|process.*exit|process.*stopped|transport.*closed|stream.*closed|channel.*closed|terminated/i;

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

interface AcpSessionSummary {
  sessionId: string;
  rawSessionId?: string;
  title: string;
}

interface HistoryRowProof {
  id: string;
  title: string;
}

async function withFixture<T>(
  fixture: AcpBddFixture,
  run: (runtime: AcpBddFixtureRuntime) => Promise<T>,
  options: Partial<Omit<AcpBddFixtureOptions, 'fixture'>> = {},
) {
  const runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture,
    profile: 'interactive',
    delayMs: 20,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1800, height: 1000 },
    ...options,
  });

  try {
    await expect(chatInput()).toBeVisible();
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
      chatErrorCount: Array.from(
        document.querySelectorAll('.AI-Chat-slot [data-message-role="assistant"] [class*="error"]'),
      ).filter(isVisible).length,
      userRowCount: Array.from(document.querySelectorAll('.AI-Chat-slot [data-message-role="user"]')).length,
      assistantRowCount: Array.from(document.querySelectorAll('.AI-Chat-slot [data-message-role="assistant"]')).length,
      hasStackTrace: /\n\s*at\s+\S+\s+\(|\bat\s+\S+:\d+:\d+/.test(visibleTextToScan),
      hasRawRpcPayload: /"jsonrpc"|rawInput|rawOutput|session\/prompt|session\/new|session\/load/i.test(
        visibleTextToScan,
      ),
      hasSecretLikeText: /token=|api[_-]?key|password|sk-[a-z0-9]/i.test(visibleTextToScan),
    };
  });
}

async function waitForFailureUiSnapshot(
  predicate: (snapshot: FailureUiSnapshot) => boolean,
): Promise<FailureUiSnapshot> {
  let snapshot = await readFailureUiSnapshot();

  await expect
    .poll(
      async () => {
        snapshot = await readFailureUiSnapshot();
        return predicate(snapshot);
      },
      { timeout: 30_000 },
    )
    .toBe(true);

  return snapshot;
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

async function waitForStreamRichRecoverySnapshot(): Promise<FailureUiSnapshot> {
  let snapshot = await readFailureUiSnapshot();

  await expect
    .poll(
      async () => {
        snapshot = await readFailureUiSnapshot();
        return (
          snapshot.chatErrorCount === 0 &&
          snapshot.userRowCount > 0 &&
          snapshot.assistantRowCount > 0 &&
          !snapshot.hasStackTrace &&
          !snapshot.hasRawRpcPayload &&
          !snapshot.hasSecretLikeText
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);

  return snapshot;
}

async function reloadFixtureWorkbench(runtime: AcpBddFixtureRuntime, ensureAgentic = true) {
  await clearAcpBddTransientSessionState(page);
  await page.goto(runtime.url);
  await waitForWorkbenchReady(page);
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await waitForAcpChatReady(page);
  if (ensureAgentic) {
    await ensureAgenticLayout(page);
  }
  await expect(chatInput()).toBeVisible();
}

async function ensureHistoryVisible() {
  const inline = page.locator('[data-testid="acp-chat-history-inline"]');
  if (await inline.isVisible().catch(() => false)) {
    return;
  }

  const popover = page.locator('[data-testid="acp-chat-history-popover"]');
  if (await popover.isVisible().catch(() => false)) {
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
  await expect(popover).toBeVisible({ timeout: 30_000 });
}

async function readHistoryRows(): Promise<HistoryRowProof[]> {
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
        return { id, title };
      });
  });
}

async function waitForVisibleSeededHistoryRows(): Promise<HistoryRowProof[]> {
  await ensureHistoryVisible();
  await expect
    .poll(
      async () => {
        const rows = await readHistoryRows();
        return rows
          .filter((row) => LOAD_FAILURE_SESSION_IDS.includes(row.id))
          .map((row) => row.id)
          .sort();
      },
      { timeout: 30_000 },
    )
    .toEqual([...LOAD_FAILURE_SESSION_IDS].sort());

  return (await readHistoryRows()).filter((row) => LOAD_FAILURE_SESSION_IDS.includes(row.id));
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

    const snapshot = await waitForStreamRichRecoverySnapshot();
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

async function createConfigFailureSession() {
  const completion = chatSlot().getByText('BDD_ASSISTANT_PART_2 completed.');
  const completionCount = await completion.count();

  await sendPrompt('BDD config failure bootstrap');
  await expect(completion).toHaveCount(completionCount + 1, { timeout: 30_000 });
  await expect(sendButton()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => configSelectors().count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
}

test.describe('ACP Chat Agentic Error Taxonomy and Recovery', () => {
  test.setTimeout(FAILURE_TEST_TIMEOUT_MS);

  test('Input and Send Recovery: send failure preserves user row and exposes retry', async () => {
    await withFixture('send-failure', async () => {
      await sendPrompt('BDD visible recovery case A');

      const snapshot = await waitForFailureUiSnapshot(
        (current) =>
          current.userRowCount > 0 && current.chatErrorCount > 0 && /send|failure|error/i.test(current.chatText),
      );
      expect(snapshot.chatErrorCount).toBeGreaterThan(0);
      expect(snapshot.userRowCount).toBeGreaterThan(0);
      await expect(recoveryButton()).toBeVisible();
      await expectInputRecovered();
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('send-failure');
  });

  test('Error Guidance: OpenCode service failure is actionable and keeps bounded diagnostics', async () => {
    await withFixture('service-failure', async () => {
      await sendPrompt('BDD OpenCode service failure guidance');

      const snapshot = await waitForFailureUiSnapshot(
        (current) =>
          current.chatErrorCount > 0 &&
          current.userRowCount > 0 &&
          /OpenCode couldn't complete the request/i.test(current.chatText) &&
          /Retry the request/i.test(current.chatText) &&
          /start a new session/i.test(current.chatText) &&
          /service: session/i.test(current.chatText) &&
          /error: DatabaseError/i.test(current.chatText) &&
          !/Internal error: OpenCode service failure/i.test(current.chatText),
      );

      expect(snapshot.chatErrorCount).toBeGreaterThan(0);
      expect(snapshot.userRowCount).toBeGreaterThan(0);
      await expect(recoveryButton()).toBeVisible();
      await expectInputRecovered();
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('service-failure');
  });

  test('Error Guidance: unavailable model identifies the model and next action', async () => {
    await withFixture('model-not-found', async () => {
      await sendPrompt('BDD unavailable model guidance');

      const snapshot = await waitForFailureUiSnapshot(
        (current) =>
          current.chatErrorCount > 0 &&
          current.userRowCount > 0 &&
          /selected model "cfuse\/GLM-5\.2" is unavailable/i.test(current.chatText) &&
          /Choose another model and try again/i.test(current.chatText) &&
          !/Invalid params: model not found/i.test(current.chatText),
      );
      expect(snapshot.chatErrorCount).toBeGreaterThan(0);
      expect(snapshot.userRowCount).toBeGreaterThan(0);
      await expect(recoveryButton()).toBeVisible();
      await expectInputRecovered();
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('model-not-found');
  });

  test('Error Taxonomy: create failure leaves the draft input recoverable', async () => {
    await withFixture('create-failure', async () => {
      await sendPrompt('BDD visible recovery case B');

      const snapshot = await waitForFailureUiSnapshot(
        (current) =>
          current.errorNotificationCount > 0 &&
          current.userRowCount === 0 &&
          /create|session|failure|error/i.test(current.notificationText),
      );
      expect(snapshot.errorNotificationCount).toBeGreaterThan(0);
      expect(snapshot.userRowCount).toBe(0);
      await expectInputRecovered();
      expect(await readSessionState()).toMatchObject({ success: true, result: { active: false } });
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('create-failure');
  });

  test('Recovery: load failure falls back to a usable draft from history selection', async () => {
    await withFixture(
      'load-failure',
      async (runtime) => {
        await sendPrompt('BDD load failure history prewarm');
        await expect.poll(async () => (await readSessionState()).result?.session?.requestCount ?? 0).toBeGreaterThan(0);
        await expectInputRecovered();

        await reloadFixtureWorkbench(runtime, false);
        await expect
          .poll(
            async () =>
              (
                await listSessions()
              )
                .filter((session) => LOAD_FAILURE_SESSION_IDS.includes(session.sessionId))
                .map((session) => session.title)
                .sort(),
            { timeout: 30_000 },
          )
          .toEqual(['BDD History alpha', 'BDD History beta']);

        const rows = await waitForVisibleSeededHistoryRows();
        const historyItem = page.locator(`[data-testid="chat-history-item-${rows[0].id}"]`).first();
        await expect(historyItem).toBeVisible({ timeout: 30_000 });
        await historyItem.click();

        let snapshot = await readFailureUiSnapshot();
        await expect
          .poll(
            async () => {
              snapshot = await readFailureUiSnapshot();
              const state = await readSessionState();
              return {
                hasRecoveryNotice: /history|new chat draft|session|not found|available/i.test(
                  snapshot.notificationText,
                ),
                hasInfoNotification: snapshot.infoNotificationCount > 0,
                active: state.result?.active,
              };
            },
            { timeout: 30_000 },
          )
          .toMatchObject({ hasRecoveryNotice: true, hasInfoNotification: true, active: false });

        expect(snapshot.infoNotificationCount).toBeGreaterThan(0);
        await expectInputRecovered();
        await expectSafeVisibleFailure(snapshot);
      },
      {
        sessionPrefix: LOAD_FAILURE_SESSION_PREFIX,
        panelLayout: 'classic',
        ensureAgenticLayout: false,
      },
    );

    await expectStreamRichRecovery('load-failure');
  });

  test('Error Taxonomy: auth-required send failure is visible and retryable', async () => {
    await withFixture('auth-required', async () => {
      await sendPrompt('BDD visible recovery case C');

      const snapshot = await waitForFailureUiSnapshot(
        (current) =>
          current.chatErrorCount > 0 &&
          current.userRowCount > 0 &&
          /auth|required|sign.?in|login/i.test(current.chatText),
      );
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
      await createConfigFailureSession();
      await selectFooterConfig(0, 'Chat');

      const snapshot = await waitForFailureUiSnapshot(
        (current) => current.errorNotificationCount > 0 && /config|failure|error/i.test(current.notificationText),
      );
      expect(snapshot.errorNotificationCount).toBeGreaterThan(0);
      await expect.poll(async () => configSelectors().count()).toBeGreaterThanOrEqual(4);
      await expectInputRecovered();
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('config-failure');
  });

  test('Error Taxonomy: disconnected agent recovery handles process exit', async () => {
    await withFixture('process-exit', async () => {
      await sendPrompt('BDD process exit recovery case D');

      const snapshot = await waitForFailureUiSnapshot((current) => {
        const visibleFailureText = `${current.chatText}\n${current.notificationText}`;
        return (
          current.userRowCount > 0 &&
          current.chatErrorCount + current.errorNotificationCount > 0 &&
          DISCONNECTED_AGENT_ERROR_PATTERN.test(visibleFailureText)
        );
      });
      expect(snapshot.userRowCount).toBeGreaterThan(0);
      expect(snapshot.chatErrorCount + snapshot.errorNotificationCount).toBeGreaterThan(0);
      await expectInputRecovered();
      await expectSafeVisibleFailure(snapshot);
    });

    await expectStreamRichRecovery('process-exit');
  });
});
