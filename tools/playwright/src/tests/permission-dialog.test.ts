// Source: test/bdd/permission-dialog.scenario.md
// Source: test/bdd/acp-chat-agentic-permission-during-send.scenario.md
// Source: test/bdd/acp-permission-routing.scenario.md
// Source: test/bdd/acp-chat-agentic-keyboard-a11y.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const PERMISSION_DIALOG_SELECTOR = '[data-testid="acp-permission-dialog"]';
const PERMISSION_CLOSE_SELECTOR = '[data-testid="acp-permission-dialog-close"]';
const PERMISSION_REJECT_SELECTOR = '[data-testid^="acp-permission-dialog-option-"][data-option-kind^="reject"]';
const PERMISSION_TITLE_SELECTOR = '[data-testid="acp-permission-dialog-title"]';
const PERMISSION_OPTIONS_SELECTOR = '[data-testid="acp-permission-dialog-options"]';
const PERMISSION_TAB_TITLE_PREFIX = /^\((\d+)\) permission\s+/;
const PERMISSION_SOURCE_SCENARIOS = [
  'test/bdd/permission-dialog.scenario.md',
  'test/bdd/acp-chat-agentic-permission-during-send.scenario.md',
  'test/bdd/acp-permission-routing.scenario.md',
];
const FORBIDDEN_PERMISSION_TOOL_NAMES = [
  'acp_handlePermissionDialog',
  'acp_chat_handlePermissionDialog',
  'acp_chat_handle_permission_dialog',
];

let runtime: AcpBddFixtureRuntime | undefined;

interface PermissionStateResult {
  success: boolean;
  result: {
    activeDialogCount: number;
    activeSessionId?: string | null;
    pendingCountExcludingActive: number;
  };
}

async function loadPermissionFixtureWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'permission',
    profile: 'full',
    delayMs: 5,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1800, height: 1000 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
}

function chatInput() {
  return page.locator('.AI-Chat-slot [contenteditable="true"]').last();
}

function permissionDialog() {
  return page.locator(PERMISSION_DIALOG_SELECTOR).first();
}

async function readToolNames(): Promise<string[]> {
  return page.evaluate(async () => {
    const tools = await (navigator as any).modelContext.getTools();
    return tools.map((tool: { name: string }) => tool.name).sort();
  });
}

async function readPermissionState(): Promise<PermissionStateResult> {
  return page.evaluate(async () => (navigator as any).modelContext.executeTool('acp_chat_get_permission_state', {}));
}

function expectPermissionStateMetadataOnly(state: PermissionStateResult) {
  expect(state.success).toBe(true);
  expect(Object.keys(state.result).sort()).toEqual([
    'activeDialogCount',
    'activeSessionId',
    'pendingCountExcludingActive',
  ]);
  expect(typeof state.result.activeDialogCount).toBe('number');
  expect(typeof state.result.pendingCountExcludingActive).toBe('number');
  expect(
    state.result.activeSessionId === undefined ||
      state.result.activeSessionId === null ||
      typeof state.result.activeSessionId === 'string',
  ).toBe(true);
}

function expectNoPermissionDecisionTools(toolNames: string[]) {
  expect(toolNames).toContain('acp_chat_get_permission_state');
  expect(toolNames).toContain('acp_chat_read_session_messages');
  expect(toolNames.filter((name) => FORBIDDEN_PERMISSION_TOOL_NAMES.includes(name))).toEqual([]);
  expect(toolNames.filter((name) => name.startsWith('_opensumi/acp_chat'))).toEqual([]);
  expect(toolNames.filter((name) => /permission/i.test(name))).toEqual(['acp_chat_get_permission_state']);
}

async function sendPermissionPrompt(prompt: string) {
  const input = chatInput();
  await expect(input).toBeVisible();
  await expect(input).toBeEditable();
  await input.click();
  await page.keyboard.type(prompt);
  await page.getByRole('button', { name: 'Send' }).click();
}

function activeSessionPermissionAttention(sessionId: string) {
  return page.locator(`[data-testid="agentic-task-attention-acp:${sessionId}"]`);
}

async function waitForPendingPermission(): Promise<PermissionStateResult> {
  await expect(permissionDialog()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(PERMISSION_TITLE_SELECTOR)).toBeVisible();
  await expect(page.locator(PERMISSION_OPTIONS_SELECTOR)).toBeVisible();

  await expect
    .poll(async () => (await readPermissionState()).result.activeDialogCount, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(1);

  const pendingState = await readPermissionState();
  expectPermissionStateMetadataOnly(pendingState);
  expect(pendingState.result.activeDialogCount).toBeGreaterThanOrEqual(1);
  expect(pendingState.result.activeSessionId).toEqual(expect.any(String));

  await expect.poll(async () => page.title(), { timeout: 10_000 }).toMatch(PERMISSION_TAB_TITLE_PREFIX);
  const permissionTitleMatch = (await page.title()).match(PERMISSION_TAB_TITLE_PREFIX);
  expect(Number(permissionTitleMatch?.[1])).toBe(pendingState.result.activeDialogCount);

  const titleText = (await page.locator(PERMISSION_TITLE_SELECTOR).textContent()) || '';
  expect(titleText.trim().length).toBeGreaterThan(0);

  const attention = activeSessionPermissionAttention(pendingState.result.activeSessionId!);
  await expect(attention).toBeVisible({ timeout: 10_000 });
  await expect(attention).toHaveAttribute('data-agentic-task-meta-kind', 'permission');
  await expect(attention).toContainText('Permission');

  return pendingState;
}

async function waitForPermissionDismissed(sessionId: string) {
  await expect(permissionDialog()).toBeHidden({ timeout: 30_000 });
  await expect.poll(async () => (await readPermissionState()).result.activeDialogCount, { timeout: 30_000 }).toBe(0);
  await expect
    .poll(async () => (await readPermissionState()).result.pendingCountExcludingActive, { timeout: 30_000 })
    .toBe(0);
  await expect(chatInput()).toBeVisible({ timeout: 30_000 });
  await expect(chatInput()).toBeEditable({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => page.title(), { timeout: 10_000 }).not.toMatch(PERMISSION_TAB_TITLE_PREFIX);
  await expect(activeSessionPermissionAttention(sessionId)).toBeHidden({ timeout: 10_000 });
}

async function readVisiblePermissionProof() {
  const state = await readPermissionState();
  const close = page.locator(PERMISSION_CLOSE_SELECTOR);
  const reject = page.locator(PERMISSION_REJECT_SELECTOR).first();
  const titleText = (await page.locator(PERMISSION_TITLE_SELECTOR).textContent()) || '';
  const tabTitle = await page.title();
  const tabTitleMatch = tabTitle.match(PERMISSION_TAB_TITLE_PREFIX);

  return {
    permissionState: state.result,
    dialogVisible: await permissionDialog().isVisible(),
    titleHasVisibleText: titleText.trim().length > 0,
    closeVisible: await close.isVisible(),
    rejectVisible: await reject.isVisible(),
    rejectOptionCount: await page.locator(PERMISSION_REJECT_SELECTOR).count(),
    tabTitle,
    tabTitlePermissionCount: tabTitleMatch ? Number(tabTitleMatch[1]) : null,
    tabTitleHasPermissionPrefix: Boolean(tabTitleMatch),
    activeSessionPermissionAttentionVisible: state.result.activeSessionId
      ? await activeSessionPermissionAttention(state.result.activeSessionId).isVisible()
      : false,
  };
}

test.describe('权限对话框确定性可观测性', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeEach(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadPermissionFixtureWorkbench();
  });

  test.afterEach(async () => {
    await runtime?.dispose();
    runtime = undefined;
  });

  test('不暴露 ACP 决策工具时，可通过可见关闭按钮关闭权限对话框', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'permission-dialog-close', {
      sourceScenario: PERMISSION_SOURCE_SCENARIOS.join(', '),
      profile: 'full',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const toolNames = await readToolNames();
    expectNoPermissionDecisionTools(toolNames);
    const baseline = await readPermissionState();
    expectPermissionStateMetadataOnly(baseline);
    expect(baseline.result.activeDialogCount).toBe(0);

    await sendPermissionPrompt('BDD permission close path');
    const pendingState = await waitForPendingPermission();
    const pendingProof = await readVisiblePermissionProof();
    expect(pendingProof).toMatchObject({
      dialogVisible: true,
      titleHasVisibleText: true,
      closeVisible: true,
      activeSessionPermissionAttentionVisible: true,
      tabTitleHasPermissionPrefix: true,
      tabTitlePermissionCount: pendingState.result.activeDialogCount,
    });

    await page.locator(PERMISSION_CLOSE_SELECTOR).click();
    await waitForPermissionDismissed(pendingState.result.activeSessionId!);
    const afterDismiss = await readPermissionState();
    expectPermissionStateMetadataOnly(afterDismiss);
    expect(afterDismiss.result.activeDialogCount).toBe(baseline.result.activeDialogCount);

    const proof = await evidence.saveJson(
      '01-permission-close-proof',
      {
        toolNames: toolNames.filter((name) => name.startsWith('acp_chat')),
        baseline: baseline.result,
        pending: pendingState.result,
        pendingProof,
        afterDismiss: afterDismiss.result,
        afterDismissTabTitle: await page.title(),
      },
      'metadata-only permission state and visible close dismissal proof',
    );
    const screenshot = await evidence.captureScreenshot(page, '02-permission-close-after-dismiss', 'chat after close');

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Full-profile WebMCP exposes permission state but no ACP permission decision tool.',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement:
        'The permission fixture creates a visible active-session dialog, pending badge/count metadata, and matching permission tab title count.',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement:
        'A visible close control dismisses the permission dialog, restores editable input, and clears the permission tab title prefix.',
      status: 'pass',
      evidence: [proof, screenshot].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement:
        'The permission-routing visible lifecycle observes active dialog counts and closes through browser UI, not ACP decision tools.',
      status: 'pass',
      evidence: [proof, screenshot].filter(Boolean) as string[],
    });
    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
        fixture: 'permission',
        profile: 'full',
      },
    });
  });

  test('不暴露 ACP 决策工具时，可通过可见拒绝按钮拒绝权限请求', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'permission-dialog-reject', {
      sourceScenario: PERMISSION_SOURCE_SCENARIOS.join(', '),
      profile: 'full',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const toolNames = await readToolNames();
    expectNoPermissionDecisionTools(toolNames);
    const baseline = await readPermissionState();
    expectPermissionStateMetadataOnly(baseline);
    expect(baseline.result.activeDialogCount).toBe(0);

    await sendPermissionPrompt('BDD permission reject path');
    const pendingState = await waitForPendingPermission();
    const pendingProof = await readVisiblePermissionProof();
    expect(pendingProof).toMatchObject({
      dialogVisible: true,
      titleHasVisibleText: true,
      rejectVisible: true,
      activeSessionPermissionAttentionVisible: true,
      tabTitleHasPermissionPrefix: true,
      tabTitlePermissionCount: pendingState.result.activeDialogCount,
    });
    expect(pendingProof.rejectOptionCount).toBeGreaterThanOrEqual(1);

    await page.locator(PERMISSION_REJECT_SELECTOR).first().click();
    await waitForPermissionDismissed(pendingState.result.activeSessionId!);
    const afterDismiss = await readPermissionState();
    expectPermissionStateMetadataOnly(afterDismiss);
    expect(afterDismiss.result.activeDialogCount).toBe(baseline.result.activeDialogCount);

    const sessionState = await page.evaluate(async () =>
      (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
    );
    expect(sessionState.success).toBe(true);
    if (sessionState.result.active) {
      expect(sessionState.result.session.hasPendingPermission).toBe(false);
      expect(sessionState.result.session.messages).toBeUndefined();
      expect(sessionState.result.session.content).toBeUndefined();
      expect(sessionState.result.session.toolCallResults).toBeUndefined();
    }

    const proof = await evidence.saveJson(
      '01-permission-reject-proof',
      {
        toolNames: toolNames.filter((name) => name.startsWith('acp_chat')),
        baseline: baseline.result,
        pending: pendingState.result,
        pendingProof,
        afterDismiss: afterDismiss.result,
        afterDismissTabTitle: await page.title(),
        sessionState: sessionState.result.active
          ? {
              active: true,
              session: {
                sessionId: sessionState.result.session.sessionId,
                rawSessionId: sessionState.result.session.rawSessionId,
                hasPendingPermission: sessionState.result.session.hasPendingPermission,
                requestCount: sessionState.result.session.requestCount,
                historyMessageCount: sessionState.result.session.historyMessageCount,
                threadStatus: sessionState.result.session.threadStatus,
              },
            }
          : { active: false },
      },
      'metadata-only permission state and visible reject dismissal proof',
    );
    const screenshot = await evidence.captureScreenshot(
      page,
      '02-permission-reject-after-dismiss',
      'chat after reject',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement:
        'The permission fixture exposes pending state through acp_chat_get_permission_state only and mirrors the count in the Web tab title.',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement:
        'A visible reject control dismisses the permission dialog, clears active pending state, and clears the permission tab title prefix.',
      status: 'pass',
      evidence: [proof, screenshot].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Session state remains metadata-only and recoverable after UI rejection.',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement:
        'The permission-routing visible reject lifecycle observes pending counts and dismisses through browser UI, not ACP decision tools.',
      status: 'pass',
      evidence: [proof, screenshot].filter(Boolean) as string[],
    });
    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
        fixture: 'permission',
        profile: 'full',
      },
    });
  });
});
