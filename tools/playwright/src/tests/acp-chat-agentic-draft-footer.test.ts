// Source: test/bdd/acp-chat-agentic-draft-footer.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const CONFIG_SELECTOR = '[role="combobox"][class*="config_selector"]';
const COMPLETION = 'BDD_ASSISTANT_PART_2 completed.';

let runtime: AcpBddFixtureRuntime;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function chatInput() {
  return page.getByRole('textbox', { name: 'Agentic chat input' });
}

async function executeTool<T>(name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ toolName, toolArgs }) => (navigator as any).modelContext.executeTool(toolName, toolArgs),
    { toolName: name, toolArgs: args },
  ) as Promise<{ success: boolean; result: T }>;
}

async function sendAndWait(prompt: string) {
  const stateBefore = await executeTool<{
    session: { historyMessageCount: number } | null;
  }>('acp_chat_get_session_state');
  const historyMessageCountBefore = stateBefore.result.session?.historyMessageCount ?? 0;
  const completion = page.locator('.AI-Chat-slot').getByText(COMPLETION);
  await chatInput().click();
  await page.keyboard.insertText(prompt);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect
    .poll(
      async () => {
        const state = await executeTool<{ session: { historyMessageCount: number } | null }>(
          'acp_chat_get_session_state',
        );
        return state.result.session?.historyMessageCount ?? 0;
      },
      { timeout: 30_000 },
    )
    .toBe(historyMessageCountBefore + 2);
  await expect(completion.last()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
}

test.describe('ACP Chat Agentic 草稿页脚', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'interactive',
      delayMs: 20,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
    await sendAndWait('BDD draft footer bootstrap');
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('新建 Session 草稿使用自己的 ACP 命令目录并保留配置', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-draft-footer', {
      sourceScenario: 'test/bdd/acp-chat-agentic-draft-footer.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const activeState = await executeTool<{ active: boolean; session: { rawSessionId?: string } | null }>(
      'acp_chat_get_session_state',
    );
    const sessionsBefore = await executeTool<{ sessions: unknown[] }>('acp_chat_list_sessions');
    const activeFooter = await page.locator(CONFIG_SELECTOR).allTextContents();
    expect(activeState.result.active).toBe(true);
    expect(activeFooter.map((value) => value.trim())).toEqual(['Agent', 'BDD Small', 'Medium', 'Off']);

    await page.getByTestId('agentic-chat-panel-header').getByTestId('agentic-task-launch-button').click();
    await expect(chatInput()).toBeFocused();

    const draftState = await executeTool<{ active: boolean; session: null }>('acp_chat_get_session_state');
    expect(draftState.result.active).toBe(false);
    expect(draftState.result.session).toBeNull();
    await expect(page.locator('[data-testid^="agentic-task-row-"]')).toHaveCount(0);
    await expect(page.locator(CONFIG_SELECTOR)).toHaveCount(4);
    expect((await page.locator(CONFIG_SELECTOR).allTextContents()).map((value) => value.trim())).toEqual(
      activeFooter.map((value) => value.trim()),
    );

    await expect(page.getByTestId('acp-skills-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect
      .poll(
        async () => {
          const commands = await executeTool<{ commands: Array<{ name: string }>; total: number }>(
            'acp_chat_get_available_commands',
          );
          return commands.result.commands.map((command) => command.name);
        },
        { timeout: 30_000 },
      )
      .toContain('bdd_echo');

    await page.keyboard.type('/');
    const commandList = page.getByRole('listbox', { name: 'Available commands' });
    await expect(commandList).toBeVisible();
    const visibleCommands = await commandList.getByRole('option').allTextContents();
    expect(visibleCommands.join('\n')).toContain('/bdd_echo');
    await page.keyboard.press('Escape');

    await chatInput().evaluate((element) => {
      element.replaceChildren(document.createTextNode('   '));
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    });
    await page.keyboard.press('Enter');
    const stateAfterWhitespace = await executeTool<{
      active: boolean;
      session: { requestCount?: number } | null;
    }>('acp_chat_get_session_state');
    expect(stateAfterWhitespace.result.session?.requestCount ?? 0).toBe(0);
    await expect(chatSlot().locator('.rce-user-msg')).toHaveCount(0);
    await expect(page.locator(CONFIG_SELECTOR)).toHaveCount(4);

    await chatInput().evaluate((element) => {
      element.replaceChildren();
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    });
    await sendAndWait('BDD draft footer first accepted prompt');
    const afterFirstSend = await executeTool<{
      active: boolean;
      session: { rawSessionId?: string; sessionId?: string } | null;
    }>('acp_chat_get_session_state');
    expect(afterFirstSend.result.active).toBe(true);
    expect(afterFirstSend.result.session?.rawSessionId).toMatch(/^bdd-session-/);
    expect(afterFirstSend.result.session?.rawSessionId).not.toContain('acp:');
    await expect(page.locator(CONFIG_SELECTOR)).toHaveCount(4);

    const proof = await evidence.saveJson(
      '01-draft-footer-lifecycle',
      {
        activeFooter: activeFooter.map((value) => value.trim()),
        draftCommands: visibleCommands,
        sessionsBefore: sessionsBefore.result.sessions.length,
        activeAfterFirstSend: afterFirstSend.result.active,
        rawSessionId: afterFirstSend.result.session?.rawSessionId,
      },
      'Session 草稿的 draft-bound ACP 命令目录、页脚配置与首条消息生命周期',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Session 草稿不会创建旧式本地 Task 记录，纯空白提交不会激活会话。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: '草稿阶段加载自己的 ACP 命令目录并保留配置，首个有效发送后激活 Session。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
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
