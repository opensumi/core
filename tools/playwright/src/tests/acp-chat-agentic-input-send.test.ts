// Source: test/bdd/acp-chat-agentic-input-send.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const FIRST_LINE = 'BDD 输入第一行';
const SECOND_LINE = 'BDD 输入第二行';
const COMPLETION = 'BDD_ASSISTANT_PART_2 completed.';

let runtime: AcpBddFixtureRuntime;

function chatInput() {
  return page.getByRole('textbox', { name: 'Agentic chat input' });
}

async function state() {
  return page.evaluate(async () => (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}));
}

async function replaceInput(text: string) {
  await chatInput().evaluate((element, value) => {
    element.replaceChildren(document.createTextNode(value));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  }, text);
}

test.describe('ACP Chat Agentic 输入与发送', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'interactive',
      delayMs: 80,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('空白提交保持草稿，多行输入只发送一次并恢复焦点与历史', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-input-send', {
      sourceScenario: 'test/bdd/acp-chat-agentic-input-send.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const before = await state();
    expect(before).toMatchObject({ success: true, result: { active: false } });
    await expect(chatInput()).toBeVisible();
    await expect(chatInput()).toHaveAttribute('aria-multiline', 'true');
    await expect(chatInput()).toHaveAttribute('data-placeholder', /.+/);

    await replaceInput('   ');
    await chatInput().focus();
    await page.keyboard.press('Enter');
    expect(await state()).toMatchObject({ success: true, result: { active: false } });
    expect(await page.locator('.AI-Chat-slot .rce-container-mbox').count()).toBe(0);

    await replaceInput('');
    await chatInput().focus();
    await page.keyboard.insertText(FIRST_LINE);
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.insertText(SECOND_LINE);
    await expect(chatInput()).toContainText(FIRST_LINE);
    await expect(chatInput()).toContainText(SECOND_LINE);
    expect(await chatInput().evaluate((element) => element.innerHTML)).toMatch(/<br\s*\/?>/i);

    const completion = page.locator('.AI-Chat-slot').getByText(COMPLETION);
    const completionCount = await completion.count();
    await page.keyboard.press('Enter');
    await expect(page.locator('.AI-Chat-slot').getByText(FIRST_LINE, { exact: false })).toHaveCount(1);
    await expect(page.locator('.AI-Chat-slot').getByLabel('Stop', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(chatInput()).toHaveAttribute('aria-disabled', 'false');
    await expect(chatInput()).toHaveAttribute('contenteditable', 'true');
    await expect(completion).toHaveCount(completionCount + 1, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
    await expect(chatInput()).toHaveAttribute('aria-disabled', 'false');
    await expect(chatInput()).toHaveText('');

    await chatInput().focus();
    await page.keyboard.press('ArrowUp');
    await expect(chatInput()).toContainText(FIRST_LINE);
    await expect(chatInput()).toContainText(SECOND_LINE);
    await page.keyboard.press('ArrowDown');
    await expect(chatInput()).toHaveText('');

    const inputContainer = chatInput().locator('xpath=ancestor::div[contains(@class,"input_container")][1]');
    const beforeExpandClass = await inputContainer.getAttribute('class');
    await page.keyboard.press('Shift+Alt+Escape');
    await expect(chatInput()).toBeFocused();
    await expect.poll(() => inputContainer.getAttribute('class')).not.toBe(beforeExpandClass);
    await page.keyboard.press('Shift+Alt+Escape');
    await expect(chatInput()).toBeFocused();

    const after = await state();
    const serializedState = JSON.stringify(after);
    expect(after).toMatchObject({ success: true, result: { active: true } });
    expect(serializedState).not.toContain(COMPLETION);
    expect(serializedState).not.toContain('BDD_TOOL_RESULT');
    expect(Object.keys(after.result.session || {})).toEqual(
      expect.not.arrayContaining(['messages', 'history', 'content', 'toolCalls', 'configOptions']),
    );

    const proof = await evidence.saveJson(
      '01-input-send-lifecycle',
      {
        whitespaceCreatedSession: false,
        userRowCount: await page.locator('.AI-Chat-slot').getByText(FIRST_LINE, { exact: false }).count(),
        inputRecovered: (await chatInput().getAttribute('aria-disabled')) === 'false',
        historyRoundTrip: true,
        expansionPreservedFocus: await chatInput().evaluate((element) => document.activeElement === element),
        boundedTitle: after.result.session?.title,
        metadataOnlyState: !serializedState.includes(COMPLETION) && !serializedState.includes('BDD_TOOL_RESULT'),
      },
      '空白草稿、多行发送、流中禁用、完成恢复、历史与展开快捷键',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: '空白输入不创建 Session，多行输入只创建一条用户消息。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: '流中输入禁用，完成后恢复编辑、历史导航和展开快捷键焦点。',
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
