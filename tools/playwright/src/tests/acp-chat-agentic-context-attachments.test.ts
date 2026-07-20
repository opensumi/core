// Source: test/bdd/acp-chat-agentic-context-attachments.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const PROMPT = 'BDD 上下文附件发送';
const COMPLETION = 'BDD_ASSISTANT_PART_2 completed.';

let runtime: AcpBddFixtureRuntime;

function chatInput() {
  return page.getByRole('textbox', { name: 'Agentic chat input' });
}

function contextList() {
  return page.getByRole('listbox', { name: 'Context suggestions' });
}

async function openRootContextList() {
  await chatInput().click();
  await page.keyboard.type('@');
  await expect(contextList()).toBeVisible();
}

async function chooseRootContext(name: 'File' | 'Folder') {
  await openRootContextList();
  await contextList().getByRole('option').filter({ hasText: name }).first().click();
  await expect(contextList()).toBeVisible();
}

test.describe('ACP Chat Agentic 上下文附件', () => {
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
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('可选择文件和文件夹、移除单个附件，并在发送后清理上下文', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-context-attachments', {
      sourceScenario: 'test/bdd/acp-chat-agentic-context-attachments.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await chooseRootContext('File');
    const editorFile = contextList().getByRole('option').filter({ hasText: 'editor.js' }).first();
    await expect(editorFile).toBeVisible({ timeout: 10_000 });
    await editorFile.click();
    await page.locator('[class*="context_preview_item"][data-type="file"]').filter({ hasText: 'editor.js' }).hover();
    const removeFile = page.getByRole('button', { name: 'Remove file context editor.js' });
    await expect(removeFile).toBeVisible();

    await chooseRootContext('Folder');
    const testFolder = contextList().getByRole('option').filter({ hasText: /^test/ }).first();
    await expect(testFolder).toBeVisible({ timeout: 10_000 });
    await testFolder.click();
    await page.locator('[class*="context_preview_item"][data-type="folder"]').filter({ hasText: 'test' }).hover();
    const removeFolder = page.getByRole('button', { name: 'Remove folder context test' });
    await expect(removeFolder).toBeVisible();

    await page.locator('[class*="context_preview_item"][data-type="file"]').filter({ hasText: 'editor.js' }).hover();
    await removeFile.focus();
    await page.keyboard.press('Enter');
    await expect(removeFile).toHaveCount(0);
    await expect(removeFolder).toHaveCount(1);

    await chatInput().click();
    await page.keyboard.insertText(PROMPT);
    const completion = page.locator('.AI-Chat-slot').getByText(COMPLETION);
    const completionCount = await completion.count();
    await page.getByRole('button', { name: 'Send' }).click();
    const sentUserRow = page.locator('.AI-Chat-slot .rce-container-mbox').filter({ hasText: PROMPT });
    await expect(sentUserRow).toHaveCount(1);
    await expect(completion).toHaveCount(completionCount + 1, { timeout: 30_000 });
    await expect(removeFolder).toHaveCount(0);
    await expect(chatInput()).toHaveText('');

    const state = await page.evaluate(async () =>
      (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
    );
    const serializedState = JSON.stringify(state);
    expect(state.success).toBe(true);
    expect(serializedState).not.toContain(COMPLETION);
    expect(serializedState).not.toContain('BDD_TOOL_RESULT');
    expect(serializedState).not.toContain('created from terminal');

    const proof = await evidence.saveJson(
      '01-context-attachments',
      {
        selectedFile: 'editor.js',
        selectedFolder: 'test',
        removedFileBeforeSend: true,
        folderCleanedAfterSend: true,
        boundedTitle: state.result.session?.title,
        metadataOnlyState: !serializedState.includes(COMPLETION) && !serializedState.includes('BDD_TOOL_RESULT'),
      },
      '文件/文件夹上下文的选择、键盘移除、发送后清理及状态安全边界',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: '文件和文件夹上下文使用工作区相对显示名，并可单独移除。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: '成功发送后输入和剩余上下文被清理，状态工具不泄漏消息正文。',
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
