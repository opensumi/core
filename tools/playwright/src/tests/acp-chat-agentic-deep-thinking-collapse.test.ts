// Source: test/bdd/acp-chat-agentic-deep-thinking-collapse.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import { type AcpBddFixtureRuntime, loadAcpBddFixtureWorkbench } from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const FIRST_REASONING_SENTINEL = 'BDD_THOUGHT_STEP_1';
const SECOND_REASONING_SENTINEL = 'BDD_CONFIG_SNAPSHOT';
const COMPLETION_SENTINEL = 'BDD_ASSISTANT_PART_2 completed.';

let runtime: AcpBddFixtureRuntime;

async function loadInteractiveStreamFixture() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'stream-rich',
    profile: 'interactive',
    delayMs: 80,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1800, height: 1000 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
}

function chatInput() {
  return page.locator('.AI-Chat-slot [contenteditable="true"]').last();
}

function deepThinkingToggles() {
  return page.getByRole('button', { name: /Deep Thinking/ });
}

async function visibleTextSnapshot() {
  return page.evaluate(() => document.body.innerText || '');
}

async function sendPrompt(prompt: string, expectedCompletionCount: number) {
  const input = chatInput();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type(prompt);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(deepThinkingToggles().last()).toBeVisible({ timeout: 30_000 });

  await page.waitForFunction(
    ({ completion, expectedCount }) => {
      const text = document.body.innerText || '';
      return text.split(completion).length - 1 >= expectedCount;
    },
    { completion: COMPLETION_SENTINEL, expectedCount: expectedCompletionCount },
    { timeout: 30_000 },
  );
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
}

async function readAcpSessionState() {
  return page.evaluate(async () => (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}));
}

test.describe('ACP Chat Agentic Deep Thinking collapse', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    await loadInteractiveStreamFixture();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('keeps Deep Thinking collapsed by default and expandable during streaming', async (_fixtures, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-deep-thinking-collapse', {
      sourceScenario: 'test/bdd/acp-chat-agentic-deep-thinking-collapse.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await sendPrompt('BDD deep thinking stays collapsed', 1);

    const collapsedAfterCompletion = await visibleTextSnapshot();
    expect(collapsedAfterCompletion).toContain('Deep Thinking');
    expect(collapsedAfterCompletion).not.toContain(FIRST_REASONING_SENTINEL);
    expect(collapsedAfterCompletion).not.toContain(SECOND_REASONING_SENTINEL);
    const collapsedProof = await evidence.saveJson(
      '01-collapsed-after-completion',
      {
        hasDeepThinking: collapsedAfterCompletion.includes('Deep Thinking'),
        hasFirstReasoningSentinel: collapsedAfterCompletion.includes(FIRST_REASONING_SENTINEL),
        hasSecondReasoningSentinel: collapsedAfterCompletion.includes(SECOND_REASONING_SENTINEL),
      },
      'completed response keeps Deep Thinking content collapsed by default',
    );

    const input = chatInput();
    await expect(input).toBeVisible();
    await input.click();
    await page.keyboard.type('BDD deep thinking expands while streaming');
    await page.getByRole('button', { name: 'Send' }).click();

    const activeToggle = deepThinkingToggles().last();
    await expect(activeToggle).toBeVisible({ timeout: 30_000 });

    const collapsedWhileStreaming = await visibleTextSnapshot();
    expect(collapsedWhileStreaming).not.toContain(FIRST_REASONING_SENTINEL);
    expect(collapsedWhileStreaming).not.toContain(SECOND_REASONING_SENTINEL);

    await activeToggle.click();
    await expect(page.getByText(FIRST_REASONING_SENTINEL)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(SECOND_REASONING_SENTINEL)).toBeVisible({ timeout: 10_000 });

    await page.waitForFunction(
      ({ completion }) => {
        const text = document.body.innerText || '';
        return text.split(completion).length - 1 >= 2;
      },
      { completion: COMPLETION_SENTINEL },
      { timeout: 30_000 },
    );

    const expandedAfterStream = await visibleTextSnapshot();
    expect(expandedAfterStream).toContain(FIRST_REASONING_SENTINEL);
    expect(expandedAfterStream).toContain(SECOND_REASONING_SENTINEL);
    const expandedProof = await evidence.saveJson(
      '02-expanded-during-stream',
      {
        hasFirstReasoningSentinel: expandedAfterStream.includes(FIRST_REASONING_SENTINEL),
        hasSecondReasoningSentinel: expandedAfterStream.includes(SECOND_REASONING_SENTINEL),
        deepThinkingToggleCount: await deepThinkingToggles().count(),
      },
      'streaming Deep Thinking expands and remains associated with the assistant response',
    );

    await activeToggle.click();
    const recollapsedAfterClick = await visibleTextSnapshot();
    expect(recollapsedAfterClick).not.toContain(FIRST_REASONING_SENTINEL);
    expect(recollapsedAfterClick).not.toContain(SECOND_REASONING_SENTINEL);
    const recollapsedProof = await evidence.saveJson(
      '03-recollapsed-after-click',
      {
        hasFirstReasoningSentinel: recollapsedAfterClick.includes(FIRST_REASONING_SENTINEL),
        hasSecondReasoningSentinel: recollapsedAfterClick.includes(SECOND_REASONING_SENTINEL),
      },
      'clicking Deep Thinking again hides reasoning sentinel text',
    );

    const sessionState = await readAcpSessionState();
    const serializedState = JSON.stringify(sessionState);
    expect(sessionState.success).toBe(true);
    expect(serializedState).not.toContain(FIRST_REASONING_SENTINEL);
    expect(serializedState).not.toContain(SECOND_REASONING_SENTINEL);
    const stateProof = await evidence.saveJson(
      '04-state-tool-metadata-only',
      {
        success: sessionState.success,
        hasFirstReasoningSentinel: serializedState.includes(FIRST_REASONING_SENTINEL),
        hasSecondReasoningSentinel: serializedState.includes(SECOND_REASONING_SENTINEL),
      },
      'ACP session state remains metadata-only after Deep Thinking interaction',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Completed ACP Agentic Deep Thinking content is collapsed by default.',
      status: 'pass',
      evidence: [collapsedProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement:
        'Streaming ACP Agentic Deep Thinking can be expanded and preserves visible reasoning through completion.',
      status: 'pass',
      evidence: [expandedProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'The same Deep Thinking toggle can collapse expanded reasoning again.',
      status: 'pass',
      evidence: [recollapsedProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement: 'ACP Chat session state does not expose reasoning sentinel content.',
      status: 'pass',
      evidence: [stateProof].filter(Boolean) as string[],
    });
    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
        fixture: 'stream-rich',
        profile: 'interactive',
      },
    });
  });
});
