// Source: test/bdd/acp-chat-agentic-debug-log-from-chat.scenario.md
// Source: test/bdd/acp-debug-log.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const PROMPT = 'BDD_DEBUG_SECRET_PROMPT';
const ASSISTANT = 'BDD_ASSISTANT_PART_2 completed.';
const TOOL_RESULT = 'BDD_TOOL_RESULT';

let runtime: AcpBddFixtureRuntime;

function chatInput() {
  return page.getByRole('textbox', { name: 'Agentic chat input' });
}

async function openDebugLog() {
  await runtime.app.quickCommandPalette.type('Open ACP Debug Log');
  await expect(page.getByText('Open ACP Debug Log', { exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'ACP Debug Log' })).toBeVisible();
}

test.describe('ACP Chat Agentic Debug Log', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'full',
      delayMs: 20,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1800, height: 1000 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('聊天流产生关联日志，查看与复制均脱敏，清空不影响当前会话', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-debug-log-from-chat', {
      sourceScenario: 'test/bdd/acp-chat-agentic-debug-log-from-chat.scenario.md',
      profile: 'full',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await chatInput().click();
    await page.keyboard.insertText(PROMPT);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.AI-Chat-slot').getByText(ASSISTANT)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });

    await openDebugLog();
    await page.getByRole('button', { name: 'Refresh' }).click();
    const log = page.locator('pre').filter({ hasText: 'thread=' });
    await expect(log).toBeVisible({ timeout: 10_000 });
    const rendered = await log.textContent();
    expect(rendered).toContain('thread=');
    expect(rendered).toContain('session=');
    expect(rendered).toMatch(/\[(incoming|outgoing|stderr)\]/);
    expect(rendered).toContain('<redacted>');
    expect(rendered).toContain('/mcp/<redacted>');
    expect(rendered).not.toMatch(/\/mcp\/[a-f0-9]{32}/i);
    expect(rendered).not.toContain(PROMPT);
    expect(rendered).not.toContain(ASSISTANT);
    expect(rendered).not.toContain(TOOL_RESULT);

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(page.url()).origin,
    });
    await page.getByRole('button', { name: 'Copy All' }).click();
    const copied = await page.evaluate(async () => navigator.clipboard.readText());
    expect(copied).toContain('/mcp/<redacted>');
    expect(copied).not.toMatch(/\/mcp\/[a-f0-9]{32}/i);
    expect(copied).not.toContain(PROMPT);
    expect(copied).not.toContain(ASSISTANT);
    expect(copied).not.toContain(TOOL_RESULT);

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('No ACP debug log entries yet.')).toBeVisible();
    await expect(page.locator('.AI-Chat-slot .rce-container-mbox').filter({ hasText: PROMPT })).toHaveCount(1);
    const state = await page.evaluate(async () =>
      (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
    );
    expect(state).toMatchObject({ success: true, result: { active: true } });

    const proof = await evidence.saveJson(
      '01-redacted-debug-log',
      {
        hasThread: rendered?.includes('thread='),
        hasSession: rendered?.includes('session='),
        hasRedactedMcpPath: rendered?.includes('/mcp/<redacted>'),
        rawMcpPathCount: rendered?.match(/\/mcp\/[a-f0-9]{32}/gi)?.length || 0,
        promptVisible: rendered?.includes(PROMPT),
        assistantVisible: rendered?.includes(ASSISTANT),
        toolResultVisible: rendered?.includes(TOOL_RESULT),
        copiedMatchesRenderedBoundary:
          copied.includes('/mcp/<redacted>') &&
          !copied.includes(PROMPT) &&
          !copied.includes(ASSISTANT) &&
          !copied.includes(TOOL_RESULT),
        chatStillActiveAfterClear: state.result.active,
      },
      '聊天流日志关联、MCP/内容脱敏、复制与清空行为',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Debug Log 按 thread/session/direction 关联当前聊天流。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: '查看和 Copy All 均脱敏 MCP token、提示词、助手内容和工具结果。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Clear 只清空日志，不清空聊天或活动 Session。',
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
