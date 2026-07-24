// Source: test/bdd/acp-chat-agentic-stream-rendering.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const PROMPT = 'BDD 确定性流渲染';
const THOUGHT_ONE = 'BDD_THOUGHT_STEP_1';
const THOUGHT_TWO = 'BDD_CONFIG_SNAPSHOT';
const PLAN_ONE = 'BDD plan: prepare deterministic stream';
const PLAN_TWO = 'BDD plan: emit tool update';
const COMPLETION = 'BDD_ASSISTANT_PART_2 completed.';

let runtime: AcpBddFixtureRuntime;

function chatInput() {
  return page.getByRole('textbox', { name: 'Agentic chat input' });
}

async function sessionState() {
  return page.evaluate(async () => (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}));
}

test.describe('ACP Chat Agentic 确定性流渲染', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'interactive',
      delayMs: 180,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('同一响应内合并内容、推理、计划与工具更新，并在完成后恢复输入', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-stream-rendering', {
      sourceScenario: 'test/bdd/acp-chat-agentic-stream-rendering.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const before = await sessionState();
    expect(before).toMatchObject({ success: true, result: { active: false } });

    await chatInput().click();
    await page.keyboard.insertText(PROMPT);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.AI-Chat-slot').getByText(PROMPT, { exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Deep Thinking/ }).last()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.AI-Chat-slot').getByLabel('Stop', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('textbox', { name: 'Agentic chat input' })).toHaveAttribute('aria-disabled', 'false');
    await expect(page.getByRole('textbox', { name: 'Agentic chat input' })).toHaveAttribute('contenteditable', 'true');

    const thinking = page.getByRole('button', { name: /Deep Thinking/ }).last();
    await expect(page.getByText(THOUGHT_ONE)).toHaveCount(0);
    await thinking.click();
    await expect(page.getByText(THOUGHT_ONE)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(THOUGHT_TWO)).toBeVisible({ timeout: 10_000 });
    await thinking.click();
    await expect(page.getByText(THOUGHT_ONE)).toHaveCount(0);

    await expect(page.getByText(PLAN_ONE)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(PLAN_TWO)).toBeVisible({ timeout: 10_000 });
    const toolHeader = page.getByRole('button', { name: /BDD deterministic tool/ });
    await expect(toolHeader).toHaveCount(1, { timeout: 10_000 });
    await expect(toolHeader).toHaveAttribute('aria-expanded', 'false');

    await expect(page.locator('.AI-Chat-slot').getByText(COMPLETION)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('textbox', { name: 'Agentic chat input' })).toHaveAttribute('aria-disabled', 'false');
    await expect(page.getByText('BDD_ASSISTANT_PART_1 for turn 1.')).toHaveCount(1);
    await expect(toolHeader).toHaveCount(1);

    await toolHeader.focus();
    await page.keyboard.press('Enter');
    await expect(toolHeader).toBeFocused();
    await expect(toolHeader).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('BDD_TOOL_RESULT')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(toolHeader).toHaveAttribute('aria-expanded', 'false');

    const after = await sessionState();
    const serializedState = JSON.stringify(after);
    expect(after).toMatchObject({ success: true, result: { active: true } });
    for (const forbidden of [THOUGHT_ONE, THOUGHT_TWO, PLAN_ONE, 'BDD_TOOL_RESULT', COMPLETION]) {
      expect(serializedState).not.toContain(forbidden);
    }
    expect(Object.keys(after.result.session || {})).toEqual(
      expect.not.arrayContaining(['messages', 'history', 'content', 'toolCalls', 'configOptions']),
    );

    const proof = await evidence.saveJson(
      '01-stream-rendering',
      {
        userRows: await page.locator('.AI-Chat-slot').getByText(PROMPT, { exact: true }).count(),
        firstContentRows: await page.getByText('BDD_ASSISTANT_PART_1 for turn 1.').count(),
        toolCards: await toolHeader.count(),
        completed: await page.locator('.AI-Chat-slot').getByText(COMPLETION).isVisible(),
        boundedTitle: after.result.session?.title,
        metadataOnlyState: ![THOUGHT_ONE, PLAN_ONE, 'BDD_TOOL_RESULT', COMPLETION].some((value) =>
          serializedState.includes(value),
        ),
      },
      '确定性 ACP 流的单响应合并、推理折叠、计划、工具卡和完成恢复',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: '用户行与助手响应不重复，推理、计划和同一工具 id 的更新保持在同一响应中。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: '完成后输入恢复，工具卡可键盘展开，状态工具保持 metadata-only。',
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
