// Source: test/bdd/acp-chat-agentic-keyboard-a11y.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const COMPLETION = 'BDD_ASSISTANT_PART_2 completed.';

let runtime: AcpBddFixtureRuntime;

function chatInput() {
  return page.getByRole('textbox', { name: 'Agentic chat input' });
}

async function clearInput() {
  await chatInput().evaluate((element) => {
    element.replaceChildren();
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
  });
}

async function executeTool<T>(name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ toolName, toolArgs }) => (navigator as any).modelContext.executeTool(toolName, toolArgs),
    { toolName: name, toolArgs: args },
  ) as Promise<{ success: boolean; result: T }>;
}

test.describe('ACP Chat Agentic 键盘可访问性', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'interactive',
      delayMs: 100,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
    await chatInput().click();
    await page.keyboard.insertText('BDD keyboard bootstrap');
    await page.keyboard.press('Enter');
    await expect(page.locator('.AI-Chat-slot').getByText(COMPLETION)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('命令面板和工具披露无需鼠标即可操作，焦点及可访问树状态保持正确', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-keyboard-a11y', {
      sourceScenario: 'test/bdd/acp-chat-agentic-keyboard-a11y.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await chatInput().focus();
    await page.keyboard.type('/');
    const commandList = page.getByRole('listbox', { name: 'Available commands' });
    await expect(commandList).toBeVisible();
    const commandListRole = await commandList.getAttribute('role');
    await expect(chatInput()).toHaveAttribute('aria-expanded', 'true');
    await expect(chatInput()).toHaveAttribute('aria-controls', 'agentic-chat-suggestion-list');
    await expect(chatInput()).toHaveAttribute('aria-activedescendant', 'agentic-chat-suggestion-option-0');

    const inputContainer = chatInput().locator('xpath=ancestor::div[contains(@class,"input_container")][1]');
    const collapsedClass = await inputContainer.getAttribute('class');
    await page.keyboard.press('Shift+Alt+Escape');
    await expect(chatInput()).toBeFocused();
    await expect(commandList).toBeVisible();
    await expect.poll(() => inputContainer.getAttribute('class')).not.toBe(collapsedClass);

    await page.keyboard.press('ArrowDown');
    await expect(commandList.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(chatInput()).toHaveAttribute('aria-activedescendant', 'agentic-chat-suggestion-option-1');
    await page.keyboard.press('Escape');
    await expect(commandList).toBeHidden();
    await expect(chatInput()).toBeFocused();
    await expect(chatInput()).toHaveAttribute('aria-expanded', 'false');

    await clearInput();
    await page.keyboard.insertText('BDD keyboard tool disclosure');
    const stateBefore = await executeTool<{ session: { historyMessageCount: number } | null }>(
      'acp_chat_get_session_state',
    );
    const historyMessageCountBefore = stateBefore.result.session?.historyMessageCount ?? 0;
    const completion = page.locator('.AI-Chat-slot').getByText(COMPLETION);
    await page.keyboard.press('Enter');
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
    const latestAssistantRow = completion.last().locator('xpath=ancestor::*[@data-message-id][1]');
    const toolHeader = latestAssistantRow.getByRole('button', { name: /BDD deterministic tool/ });
    await expect(toolHeader).toBeVisible();
    await expect(toolHeader).toHaveAttribute('aria-expanded', 'false');
    const toolContent = toolHeader.locator('xpath=following-sibling::div[1]');
    await expect(toolContent).toHaveAttribute('inert', '');
    await expect(toolContent).toHaveAttribute('aria-hidden', 'true');

    await toolHeader.focus();
    await page.keyboard.press('Enter');
    await expect(toolHeader).toBeFocused();
    await expect(toolHeader).toHaveAttribute('aria-expanded', 'true');
    await expect(toolContent).not.toHaveAttribute('inert', '');
    await expect(toolContent).toHaveAttribute('aria-hidden', 'false');

    await toolHeader.evaluate((element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true }));
    });
    await expect(toolHeader).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(toolHeader).toHaveAttribute('aria-expanded', 'false');

    const scrollBeforeSpace = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    await page.keyboard.press('Space');
    await expect(toolHeader).toHaveAttribute('aria-expanded', 'true');
    await expect(toolHeader).toBeFocused();
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(scrollBeforeSpace);
    await page.keyboard.press('Space');
    await expect(toolHeader).toHaveAttribute('aria-expanded', 'false');
    await expect(toolContent).toHaveAttribute('inert', '');
    await expect(toolContent).toHaveAttribute('aria-hidden', 'true');

    const proof = await evidence.saveJson(
      '01-keyboard-a11y',
      {
        commandListRole,
        activeDescendantAfterClose: await chatInput().getAttribute('aria-activedescendant'),
        toolExpanded: await toolHeader.getAttribute('aria-expanded'),
        toolContentInert: await toolContent.getAttribute('inert'),
        toolContentAriaHidden: await toolContent.getAttribute('aria-hidden'),
        scrollBeforeSpace,
        scrollAfterSpace: await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })),
      },
      '命令面板键盘焦点、展开优先级及工具披露的 Enter/Space/inert 契约',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: '输入框通过 ARIA 关联命令 listbox、当前 option 和展开状态。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: '工具卡 Enter/Space 可切换且保持焦点；折叠内容从键盘和可访问树隔离。',
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
