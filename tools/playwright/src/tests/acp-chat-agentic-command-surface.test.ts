// Source: test/bdd/acp-chat-agentic-command-surface.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const COMPLETION = 'BDD_ASSISTANT_PART_2 completed.';
const PROMPT = 'BDD slash 命令发送';

let runtime: AcpBddFixtureRuntime;

function chatInput() {
  return page.getByRole('textbox', { name: 'Agentic chat input' });
}

function commandList() {
  return page.getByRole('listbox', { name: 'Available commands' });
}

async function clearInput() {
  await chatInput().evaluate((element) => {
    element.replaceChildren();
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
  });
}

async function sendBootstrapPrompt() {
  const completion = page.locator('.AI-Chat-slot').getByText(COMPLETION);
  const previousCount = await completion.count();
  await chatInput().click();
  await page.keyboard.insertText('BDD command metadata bootstrap');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(completion).toHaveCount(previousCount + 1, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
}

test.describe('ACP Chat Agentic 命令面板', () => {
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
    await sendBootstrapPrompt();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('可用键盘发现、选择、取消并发送 slash 命令', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-command-surface', {
      sourceScenario: 'test/bdd/acp-chat-agentic-command-surface.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const commandResult = await page.evaluate(async () =>
      (navigator as any).modelContext.executeTool('acp_chat_get_available_commands', {}),
    );
    expect(commandResult).toMatchObject({ success: true, result: { total: 3 } });
    const commandNames = commandResult.result.commands.map((command: { name: string }) => `/${command.name}`);

    await clearInput();
    await chatInput().click();
    await page.keyboard.type('/');
    await expect(commandList()).toBeVisible();
    const optionTexts = await commandList().getByRole('option').allTextContents();
    expect(optionTexts.length).toBeGreaterThanOrEqual(3);
    await expect(commandList().getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    for (const commandName of commandNames) {
      expect(optionTexts.join('\n')).toContain(commandName);
    }

    await page.keyboard.press('Escape');
    await expect(commandList()).toBeHidden();
    await expect(chatInput()).toContainText('/');
    await expect(chatInput()).toBeFocused();

    await clearInput();
    await page.keyboard.type('/');
    await expect(commandList()).toBeVisible();
    const planIndex = (await commandList().getByRole('option').allTextContents()).findIndex((text) =>
      text.includes('/bdd_plan'),
    );
    expect(planIndex).toBeGreaterThanOrEqual(0);
    for (let index = 0; index < planIndex; index++) {
      await page.keyboard.press('ArrowDown');
    }
    await expect(commandList().getByRole('option').nth(planIndex)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(commandList()).toBeHidden();
    await expect(chatInput().locator('[data-command="/bdd_plan"]')).toHaveCount(1);
    await expect(chatInput()).toHaveAttribute('aria-expanded', 'false');
    await expect(chatInput()).toBeFocused();

    await chatInput().press('Escape');
    await expect(chatInput().locator('[data-command="/bdd_plan"]')).toHaveCount(0);
    await expect(chatInput()).toBeFocused();

    await clearInput();
    await page.keyboard.type('/');
    for (let index = 0; index < planIndex; index++) {
      await page.keyboard.press('ArrowDown');
    }
    await page.keyboard.press('Enter');
    await page.keyboard.insertText(PROMPT);
    const completion = page.locator('.AI-Chat-slot').getByText(COMPLETION);
    const completionCount = await completion.count();
    await page.getByRole('button', { name: 'Send' }).click();
    const sentUserRow = page.locator('.AI-Chat-slot .rce-container-mbox').filter({ hasText: PROMPT });
    await expect(sentUserRow).toHaveCount(1);
    await expect(completion).toHaveCount(completionCount + 1, { timeout: 30_000 });
    await expect(chatInput()).toHaveText('');

    const state = await page.evaluate(async () =>
      (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
    );
    const serializedState = JSON.stringify(state);
    expect(state.success).toBe(true);
    expect(serializedState).not.toContain(COMPLETION);
    expect(serializedState).not.toContain('BDD_TOOL_RESULT');

    const proof = await evidence.saveJson(
      '01-command-surface',
      {
        commandNames,
        optionCount: optionTexts.length,
        selectedCommand: '/bdd_plan',
        sentUserRows: await sentUserRow.count(),
        boundedTitle: state.result.session?.title,
        metadataOnlyState: !serializedState.includes(COMPLETION) && !serializedState.includes('BDD_TOOL_RESULT'),
      },
      '命令元数据、键盘选择取消、发送和状态安全边界',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: '命令面板与安全元数据一致，并暴露可访问的键盘选中态。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Escape 先关闭面板，再取消已选择命令；重新选择后只发送一次。',
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
