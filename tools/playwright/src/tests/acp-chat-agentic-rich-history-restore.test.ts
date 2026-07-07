// Source: test/bdd/acp-chat-agentic-rich-history-restore.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForAcpChatReady,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const SESSION_PREFIX = 'bdd-rich-history';
const SEEDED_SESSION_IDS = [`acp:${SESSION_PREFIX}-alpha`, `acp:${SESSION_PREFIX}-beta`];
const RICH_PROMPT = 'BDD rich history restore';
const METADATA_LEAK_SENTINELS = [
  'BDD_ASSISTANT_PART',
  'BDD_THOUGHT_STEP',
  'BDD_TOOL_RESULT',
  'BDD_USER_TURN',
  'BDD_HISTORY_USER',
  'BDD_HISTORY_THOUGHT',
  'BDD_HISTORY_ASSISTANT',
  'BDD_HISTORY_TOOL_RESULT',
];

let runtime: AcpBddFixtureRuntime;

interface AcpSessionSummary {
  sessionId: string;
  rawSessionId?: string;
  title: string;
  createdAt: number;
  requestCount: number;
  historyMessageCount: number;
  slicedMessageCount: number;
  threadStatus?: string;
}

interface RichUiProof {
  userRows: number;
  assistantRows: number;
  reasoningToggleCount: number;
  toolCardCount: number;
  hasPlanChecklistText: boolean;
  sendVisible: boolean;
  stopVisible: boolean;
}

async function loadHistoryWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'history',
    profile: 'interactive',
    delayMs: 20,
    sessionPrefix: SESSION_PREFIX,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1600, height: 900 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
}

async function showAcpChatView() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await waitForAcpChatReady(page);
  await ensureAgenticLayout(page);
}

async function executeAcpTool<T>(name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ toolName, toolArgs }) => (navigator as any).modelContext.executeTool(toolName, toolArgs),
    { toolName: name, toolArgs: args },
  ) as Promise<{ success: boolean; result: T }>;
}

async function listSessions(): Promise<AcpSessionSummary[]> {
  const result = await executeAcpTool<{ sessions: AcpSessionSummary[]; total: number }>('acp_chat_list_sessions');
  expect(result.success).toBe(true);
  return result.result.sessions;
}

async function getSessionState() {
  const result = await executeAcpTool<{ active: boolean; session: AcpSessionSummary | null }>(
    'acp_chat_get_session_state',
  );
  expect(result.success).toBe(true);
  return result.result;
}

async function waitForSeededSessions(): Promise<AcpSessionSummary[]> {
  await expect
    .poll(
      async () => {
        const sessions = await listSessions();
        return sessions
          .map((session) => session.sessionId)
          .filter((id) => SEEDED_SESSION_IDS.includes(id))
          .sort();
      },
      { timeout: 30_000 },
    )
    .toEqual([...SEEDED_SESSION_IDS].sort());

  return (await listSessions()).filter((session) => SEEDED_SESSION_IDS.includes(session.sessionId));
}

async function ensureHistoryVisible() {
  const inline = page.locator('[data-testid="acp-chat-history-inline"]');
  if (await inline.isVisible().catch(() => false)) {
    return;
  }

  const collapsed = page.locator('[data-testid="acp-chat-history-collapsed"]');
  if (await collapsed.isVisible().catch(() => false)) {
    await page.getByLabel(/Expand Chat History|展开聊天历史/).click();
    await expect(inline).toBeVisible({ timeout: 30_000 });
    return;
  }

  const popoverButton = page.locator('[data-testid="acp-chat-history-button"]');
  await expect(popoverButton).toBeVisible({ timeout: 30_000 });
  await popoverButton.click();
  await expect(page.locator('[data-testid="acp-chat-history-popover"]')).toBeVisible({ timeout: 30_000 });
}

async function clickHistoryItem(sessionId: string) {
  await ensureHistoryVisible();
  const row = page.locator(`[data-testid="chat-history-item-${sessionId}"]`).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect
    .poll(
      async () => {
        const state = await getSessionState();
        return state.session?.sessionId;
      },
      { timeout: 30_000 },
    )
    .toBe(sessionId);
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function sendButton() {
  return chatSlot()
    .getByRole('button', { name: /^(Enter\s+)?Send$|^Enter\s+发送$|^发送$/i })
    .last();
}

async function sendPromptAndWaitForRichUi(prompt: string) {
  const input = chatInput();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type(prompt);
  await expect(sendButton()).toBeVisible();
  await sendButton().click();

  await expect(
    page
      .locator('.AI-Chat-slot')
      .getByText(/Deep Thinking|深度思考/)
      .last(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page
      .locator('.AI-Chat-slot')
      .getByText(/Called (?:MCP )?Tool/)
      .last(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(sendButton()).toBeVisible({ timeout: 30_000 });
}

async function readRichUiProof(): Promise<RichUiProof> {
  return page.evaluate(() => {
    const slot = document.querySelector('.AI-Chat-slot') as HTMLElement | null;
    const text = slot?.innerText || '';
    const countPattern = (pattern: RegExp) => text.match(pattern)?.length || 0;
    const visibleButtons = Array.from(
      slot?.querySelectorAll<HTMLElement>('button, [role="button"], [aria-label]') || [],
    ).filter((button) => {
      const rect = button.getBoundingClientRect();
      const style = window.getComputedStyle(button);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const hasVisibleButton = (pattern: RegExp) =>
      visibleButtons.some((button) =>
        pattern.test([button.innerText, button.getAttribute('aria-label'), button.getAttribute('title')].join(' ')),
      );

    return {
      userRows: slot?.querySelectorAll('.rce-user-msg').length || 0,
      assistantRows: slot?.querySelectorAll('.rce-ai-msg').length || 0,
      reasoningToggleCount: visibleButtons.filter((button) => /Deep Thinking|深度思考/.test(button.innerText)).length,
      toolCardCount: countPattern(/Called\s+(?:MCP\s+)?Tool/g),
      hasPlanChecklistText: text.includes('BDD plan:'),
      sendVisible: hasVisibleButton(/Send|发送/),
      stopVisible: hasVisibleButton(/Stop|停止/),
    };
  });
}

function expectRichUiRestored(proof: RichUiProof, baseline: RichUiProof) {
  expect(proof.userRows).toBe(baseline.userRows + 1);
  expect(proof.assistantRows).toBeGreaterThanOrEqual(baseline.assistantRows + 1);
  expect(proof.reasoningToggleCount).toBeGreaterThanOrEqual(baseline.reasoningToggleCount + 1);
  expect(proof.toolCardCount).toBeGreaterThanOrEqual(baseline.toolCardCount + 1);
  expect(proof.hasPlanChecklistText).toBe(true);
  expect(proof.sendVisible).toBe(true);
  expect(proof.stopVisible).toBe(false);
}

async function waitForRichUiRestored(baseline: RichUiProof): Promise<RichUiProof> {
  let proof = await readRichUiProof();

  await expect
    .poll(
      async () => {
        proof = await readRichUiProof();
        try {
          expectRichUiRestored(proof, baseline);
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true);

  expectRichUiRestored(proof, baseline);
  return proof;
}

function expectMetadataOnly(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const sentinel of METADATA_LEAK_SENTINELS) {
    expect(serialized).not.toContain(sentinel);
  }
}

test.describe('ACP Chat Agentic Rich History Restore', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadHistoryWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('Rich History Restore keeps structured fixture UI across session switching', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-rich-history-restore', {
      sourceScenario: 'test/bdd/acp-chat-agentic-rich-history-restore.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    const [richSession, otherSession] = await waitForSeededSessions();
    await clickHistoryItem(otherSession.sessionId);
    const otherBaseline = await readRichUiProof();

    await clickHistoryItem(richSession.sessionId);
    const richBaseline = await readRichUiProof();
    await sendPromptAndWaitForRichUi(RICH_PROMPT);

    const initialRichProof = await waitForRichUiRestored(richBaseline);
    const initialProof = await evidence.saveJson(
      '01-rich-ui-before-switch',
      { activeSession: await getSessionState(), ui: initialRichProof },
      'history fixture rich response before session switching',
    );

    await clickHistoryItem(otherSession.sessionId);
    const otherSessionProof = await readRichUiProof();
    expect(otherSessionProof.userRows).toBe(otherBaseline.userRows);
    expect(otherSessionProof.assistantRows).toBe(otherBaseline.assistantRows);
    expect(otherSessionProof.toolCardCount).toBe(otherBaseline.toolCardCount);
    expect(otherSessionProof.reasoningToggleCount).toBe(otherBaseline.reasoningToggleCount);

    await clickHistoryItem(richSession.sessionId);
    const restoredRichProof = await waitForRichUiRestored(richBaseline);
    const restoredProof = await evidence.saveJson(
      '02-rich-ui-after-switch-back',
      { activeSession: await getSessionState(), ui: restoredRichProof },
      'rich reasoning, plan, and tool-call UI after switching away and back',
    );

    const state = await getSessionState();
    const sessions = await listSessions();
    expect(state.active).toBe(true);
    expect(state.session?.sessionId).toBe(richSession.sessionId);
    expect(state.session?.title).toBeTruthy();
    expectMetadataOnly({ state, sessions });

    const metadataProof = await evidence.saveJson(
      '03-metadata-only-after-rich-restore',
      { state, sessions },
      'state and list tools stay metadata-only after rich history restore',
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await showAcpChatView();
    await waitForSeededSessions();
    await clickHistoryItem(richSession.sessionId);

    const postReloadState = await getSessionState();
    const postReloadSessions = await listSessions();
    const postReloadUi = await readRichUiProof();
    expect(postReloadState.active).toBe(true);
    expect(postReloadState.session?.sessionId).toBe(richSession.sessionId);
    expect(postReloadUi.userRows).toBeGreaterThanOrEqual(1);
    expect(postReloadUi.userRows).toBeLessThanOrEqual(2);
    expect(postReloadUi.assistantRows).toBeGreaterThanOrEqual(1);
    expect(postReloadUi.assistantRows).toBeLessThanOrEqual(3);
    expect(postReloadUi.stopVisible).toBe(false);
    expectMetadataOnly({ postReloadState, postReloadSessions });

    const postReloadProof = await evidence.saveJson(
      '04-bounded-shell-after-reload',
      { state: postReloadState, sessions: postReloadSessions, ui: postReloadUi },
      'page reload recovers the deterministic session shell without metadata leakage',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'The history fixture emits visible reasoning, plan, and tool-call UI for a completed response.',
      status: 'pass',
      evidence: [initialProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Switching away and back restores the same rich response structure without duplicate user rows.',
      status: 'pass',
      evidence: [restoredProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'State and list tools expose only bounded session metadata after rich response restore.',
      status: 'pass',
      evidence: [metadataProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement: 'Reload recovers a bounded visible shell for the rich session without stale loading state.',
      status: 'pass',
      evidence: [postReloadProof].filter(Boolean) as string[],
      notes:
        'The existing loadSession history path restores transcript rows, but not full reasoning/tool response parts after page reload.',
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
