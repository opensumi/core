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
  const completion = page.locator('.AI-Chat-slot').getByText(COMPLETION);
  const completionCount = await completion.count();
  await chatInput().click();
  await page.keyboard.insertText(prompt);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(completion).toHaveCount(completionCount + 1, { timeout: 30_000 });
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

  test('新建 Task 草稿不会提前建 Session，且保留配置与命令入口', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-draft-footer', {
      sourceScenario: 'test/bdd/acp-chat-agentic-draft-footer.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const activeState = await executeTool<{ active: boolean; session: { rawSessionId?: string } | null }>(
      'acp_chat_get_session_state',
    );
    const activeCommands = await executeTool<{ commands: Array<{ name: string }>; total: number }>(
      'acp_chat_get_available_commands',
    );
    const sessionsBefore = await executeTool<{ sessions: unknown[] }>('acp_chat_list_sessions');
    const activeFooter = await page.locator(CONFIG_SELECTOR).allTextContents();
    expect(activeState.result.active).toBe(true);
    expect(activeCommands.result.total).toBe(3);
    expect(activeFooter.map((value) => value.trim())).toEqual(['Agent', 'BDD Small', 'Medium', 'Off']);

    await page.getByTestId('agentic-chat-panel-header').getByTestId('agentic-task-launch-button').click();
    await expect(chatInput()).toBeFocused();

    const draftState = await executeTool<{ active: boolean; session: null }>('acp_chat_get_session_state');
    const sessionsAfterNewTask = await executeTool<{ sessions: unknown[] }>('acp_chat_list_sessions');
    expect(draftState.result.active).toBe(false);
    expect(draftState.result.session).toBeNull();
    expect(sessionsAfterNewTask.result.sessions).toHaveLength(sessionsBefore.result.sessions.length);
    await expect(page.locator(CONFIG_SELECTOR)).toHaveCount(4);
    expect((await page.locator(CONFIG_SELECTOR).allTextContents()).map((value) => value.trim())).toEqual(
      activeFooter.map((value) => value.trim()),
    );

    await page.keyboard.type('/');
    const commandList = page.getByRole('listbox', { name: 'Available commands' });
    await expect(commandList).toBeVisible();
    const visibleCommands = await commandList.getByRole('option').allTextContents();
    for (const command of activeCommands.result.commands) {
      expect(visibleCommands.join('\n')).toContain(`/${command.name}`);
    }
    await page.keyboard.press('Escape');

    await chatInput().evaluate((element) => {
      element.replaceChildren(document.createTextNode('   '));
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    });
    await page.keyboard.press('Enter');
    const stateAfterWhitespace = await executeTool<{ active: boolean; session: null }>('acp_chat_get_session_state');
    const sessionsAfterWhitespace = await executeTool<{ sessions: unknown[] }>('acp_chat_list_sessions');
    expect(stateAfterWhitespace.result.active).toBe(false);
    expect(sessionsAfterWhitespace.result.sessions).toHaveLength(sessionsBefore.result.sessions.length);
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
        commandCount: activeCommands.result.total,
        sessionsBefore: sessionsBefore.result.sessions.length,
        sessionsAfterNewTask: sessionsAfterNewTask.result.sessions.length,
        sessionsAfterWhitespace: sessionsAfterWhitespace.result.sessions.length,
        activeAfterFirstSend: afterFirstSend.result.active,
        rawSessionId: afterFirstSend.result.session?.rawSessionId,
      },
      'Task 草稿的惰性 Session 生命周期、页脚配置与命令入口连续性',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'New Task 和纯空白提交都不创建空 Session。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: '草稿阶段保留配置控件与命令入口，首个有效发送后创建原始 Session。',
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
