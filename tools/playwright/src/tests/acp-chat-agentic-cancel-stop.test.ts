// Source: test/bdd/acp-chat-agentic-cancel-stop.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const LONG_STREAM_PROMPT = 'BDD cancel stop long stream';
const ACTIVE_STREAM_SENTINEL = 'BDD_LONG_STREAM_CHUNK_02';
const POST_CANCEL_DRAFT = 'BDD post cancel draft';

let runtime: AcpBddFixtureRuntime;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

async function loadLongStreamWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'long-stream',
    profile: 'interactive',
    delayMs: 40,
    longStreamTicks: 120,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1600, height: 900 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

function chatButton(name: string) {
  return chatSlot().getByRole('button', { name, exact: true });
}

async function sendPrompt(prompt: string) {
  const input = chatInput();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type(prompt);
  await chatButton('Send').click();
}

async function showAcpChatView() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await ensureAgenticLayout(page);
}

async function getSessionState() {
  const result = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  expect(result.success).toBe(true);
  return result.result as {
    active: boolean;
    session: { sessionId?: string; threadStatus?: string; requestCount?: number } | null;
  };
}

test.describe('ACP Chat Agentic Cancel Stop', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadLongStreamWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('Cancel Stop returns the input to a usable state during the long-stream fixture', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-cancel-stop', {
      sourceScenario: 'test/bdd/acp-chat-agentic-cancel-stop.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await sendPrompt(LONG_STREAM_PROMPT);

    await expect(chatSlot().locator('.rce-user-msg')).toHaveCount(1, { timeout: 30_000 });
    await expect(chatSlot().getByText(ACTIVE_STREAM_SENTINEL)).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeVisible();
    const activeState = await getSessionState();
    const sessionId = activeState.session?.sessionId;
    expect(sessionId).toBeTruthy();
    const taskRow = page.getByTestId(`agentic-task-row-${sessionId}`);
    await expect(taskRow).toBeVisible({ timeout: 30_000 });
    await expect(taskRow.locator('[data-agentic-task-meta-kind="running"]')).toBeVisible();
    await expect(taskRow.locator('[data-agentic-task-meta-kind="running"] .codicon-pulse')).toBeVisible();
    await expect(taskRow.locator('.codicon-modifier-spin')).toHaveCount(0);

    const activeProof = await evidence.saveJson(
      '01-active-stream',
      {
        userRows: await chatSlot().locator('.rce-user-msg').count(),
        assistantRows: await chatSlot().locator('.rce-ai-msg').count(),
        hasActiveSentinel: await chatSlot().getByText(ACTIVE_STREAM_SENTINEL).isVisible(),
        stopVisible: await chatButton('Stop').isVisible(),
        taskRunningIcon: await taskRow.locator('.codicon-pulse').isVisible(),
        taskSpinnerVisible: await taskRow
          .locator('.codicon-modifier-spin')
          .isVisible()
          .catch(() => false),
      },
      'long-stream request shows active content, a stop affordance, and a static running indicator',
    );

    await chatButton('Stop').click();
    await expect(chatButton('Send')).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeHidden();
    await expect(taskRow.locator('[data-agentic-task-meta-kind="running"]')).toHaveCount(0);
    await expect(taskRow.locator('.codicon-modifier-spin')).toHaveCount(0);

    const input = chatInput();
    await input.click();
    await page.keyboard.type(POST_CANCEL_DRAFT);
    await expect(input).toContainText(POST_CANCEL_DRAFT);
    await chatButton('Send').click();
    await expect(chatSlot().locator('.rce-user-msg')).toHaveCount(2, { timeout: 30_000 });
    await expect(chatButton('Send')).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeHidden();

    const followUpState = await getSessionState();
    expect(followUpState.session?.sessionId).toBe(sessionId);
    expect(followUpState.session?.requestCount).toBe(2);
    expect(followUpState.session?.threadStatus).toBe('awaiting_prompt');
    await expect(taskRow.locator('[data-agentic-task-meta-kind="running"]')).toHaveCount(0);
    await expect(taskRow.locator('.codicon-modifier-spin')).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await showAcpChatView();

    const restoredTaskRow = page.getByTestId(`agentic-task-row-${sessionId}`);
    await expect(restoredTaskRow).toBeVisible({ timeout: 30_000 });
    await expect(restoredTaskRow.locator('[data-agentic-task-meta-kind="running"]')).toHaveCount(0);
    await expect(restoredTaskRow.locator('.codicon-modifier-spin')).toHaveCount(0);

    const stoppedProof = await evidence.saveJson(
      '02-stopped-input-usable',
      {
        sendVisible: await chatButton('Send').isVisible(),
        stopVisible: await chatButton('Stop')
          .isVisible()
          .catch(() => false),
        followUpSession: followUpState.session,
        taskRunningAfterReload: await restoredTaskRow
          .locator('[data-agentic-task-meta-kind="running"]')
          .isVisible()
          .catch(() => false),
        taskSpinnerAfterReload: await restoredTaskRow
          .locator('.codicon-modifier-spin')
          .isVisible()
          .catch(() => false),
      },
      'stopping restores the session, permits a follow-up turn, and leaves no running spinner after reload',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'The long-stream fixture visibly enters active streaming state.',
      status: 'pass',
      evidence: [activeProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'A user-facing stop control is visible while the stream is active.',
      status: 'pass',
      evidence: [activeProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'Stopping updates the Task Row, permits a follow-up turn, and survives reload without a spinner.',
      status: 'pass',
      evidence: [stoppedProof].filter(Boolean) as string[],
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
