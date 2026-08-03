// Source: test/bdd/acp-chat-agentic-layout-stress.scenario.md

import { expect } from '@playwright/test';

import test, { page, resetPage } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const LONG_STREAM_PROMPT = 'BDD layout stress long content';
const LONG_CONTENT_SENTINEL = 'BDD_LONG_STREAM_CHUNK_40';

let runtime: AcpBddFixtureRuntime;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

interface LayoutBoundsProof {
  viewport: {
    width: number;
    height: number;
  };
  chatSlot?: RectProof;
  workbench?: RectProof;
  conversation?: RectProof;
  taskList?: RectProof;
  taskTitle?: RectProof;
  explorer?: RectProof;
  explorerFileRow?: RectProof;
  messageViewport?: RectProof;
  messageList?: RectProof;
  input?: RectProof;
  messageCount: number;
  overflowingMessageCount: number;
  pageHasHorizontalOverflow: boolean;
  messageListScrollable: boolean;
}

interface RectProof {
  x: number;
  y: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

async function loadLongStreamWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'long-stream',
    profile: 'interactive',
    delayMs: 25,
    longStreamTicks: 220,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1440, height: 820 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

function chatButton(name: string) {
  if (name === 'Stop') {
    return chatSlot().getByLabel('Stop', { exact: true });
  }
  return chatSlot().getByRole('button', { name });
}

async function sendPrompt(prompt: string) {
  const input = chatInput();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type(prompt);
  await chatButton('Send').click();
}

async function readLayoutBounds(): Promise<LayoutBoundsProof> {
  return page.evaluate(() => {
    const toRect = (rect: DOMRect): RectProof => ({
      x: rect.x,
      y: rect.y,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    });
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const chatSlot = document.querySelector('.AI-Chat-slot');
    const workbench = document.querySelector('#workbench-editor');
    const conversation = document.querySelector('.AI-Chat-slot [class*="body_container"]');
    const taskList = document.querySelector('[data-testid="agentic-task-list"]');
    const taskTitle = document.querySelector('[data-testid^="agentic-task-row-"] span');
    const explorer = document.querySelector('[data-viewlet-id="explorer"]');
    const explorerFileRow = Array.from(
      explorer?.querySelectorAll<HTMLElement>('[class*="file_tree_node__"]') || [],
    ).find(isVisible);
    const leftContainer = document.querySelector('#ai_chat_left_container');
    const messageViewport = leftContainer?.querySelector('[class*="chat_container"]');
    const messageList = leftContainer?.querySelector('.rce-mlist');
    const input = leftContainer?.querySelector('[contenteditable="true"]');
    const agenticMessageRows = Array.from(leftContainer?.querySelectorAll('[data-testid="agentic-message-row"]') || []);
    const messageRows = Array.from(leftContainer?.querySelectorAll('.rce-mbox') || []).filter(isVisible);
    const chatRect = chatSlot?.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();

    const overflowingMessageCount = chatRect
      ? messageRows.filter((row) => {
          const rect = row.getBoundingClientRect();
          return rect.left < chatRect.left - 2 || rect.right > chatRect.right + 2;
        }).length
      : messageRows.length;

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      chatSlot: chatRect ? toRect(chatRect) : undefined,
      workbench: workbench ? toRect(workbench.getBoundingClientRect()) : undefined,
      conversation: conversation ? toRect(conversation.getBoundingClientRect()) : undefined,
      taskList: taskList ? toRect(taskList.getBoundingClientRect()) : undefined,
      taskTitle: taskTitle ? toRect(taskTitle.getBoundingClientRect()) : undefined,
      explorer: explorer && isVisible(explorer) ? toRect(explorer.getBoundingClientRect()) : undefined,
      explorerFileRow: explorerFileRow ? toRect(explorerFileRow.getBoundingClientRect()) : undefined,
      messageViewport: messageViewport ? toRect(messageViewport.getBoundingClientRect()) : undefined,
      messageList: messageList ? toRect(messageList.getBoundingClientRect()) : undefined,
      input: inputRect ? toRect(inputRect) : undefined,
      messageCount: agenticMessageRows.length,
      overflowingMessageCount,
      pageHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      messageListScrollable: messageList ? messageList.scrollHeight > messageList.clientHeight + 8 : false,
    };
  });
}

function expectLayoutBounds(proof: LayoutBoundsProof, workbenchExpected = true) {
  expect(proof.chatSlot?.width).toBeGreaterThanOrEqual(640);
  expect(proof.conversation?.width).toBeGreaterThanOrEqual(360);
  expect(proof.taskList?.width).toBeGreaterThanOrEqual(208);
  expect(proof.taskTitle?.width).toBeGreaterThanOrEqual(72);
  expect(proof.chatSlot?.right).toBeLessThanOrEqual(proof.viewport.width + 2);
  if (workbenchExpected) {
    expect(proof.workbench?.width).toBeGreaterThan(0);
    expect(proof.explorer?.width).toBeGreaterThanOrEqual(240);
    expect(proof.explorerFileRow?.width).toBeGreaterThanOrEqual(160);
  } else {
    expect(proof.workbench?.width ?? 0).toBe(0);
    expect(proof.explorer?.width ?? 0).toBe(0);
  }
  expect(proof.messageCount).toBeGreaterThanOrEqual(2);
  expect(proof.overflowingMessageCount).toBe(0);
  expect(proof.pageHasHorizontalOverflow).toBe(false);
  expect(proof.messageListScrollable).toBe(true);
  expect(proof.messageViewport?.bottom).toBeLessThanOrEqual((proof.input?.top ?? Number.POSITIVE_INFINITY) + 2);
}

async function waitForScrollableMessageList() {
  await expect
    .poll(async () => (await readLayoutBounds()).messageListScrollable, {
      timeout: 10_000,
      message: 'long stream message list should become scrollable',
    })
    .toBe(true);
}

test.describe('ACP Chat Agentic Layout Stress', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await resetPage(browser);
    await loadLongStreamWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('Layout Stress keeps long-stream content inside Agentic bounds', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-layout-stress', {
      sourceScenario: 'test/bdd/acp-chat-agentic-layout-stress.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await sendPrompt(LONG_STREAM_PROMPT);
    await expect(chatSlot().getByText(LONG_CONTENT_SENTINEL)).toBeVisible({ timeout: 30_000 });
    await expect(chatButton('Stop')).toBeVisible();
    await expect(page.locator('[data-testid^="agentic-task-row-"]').first()).toBeVisible({ timeout: 30_000 });
    await waitForScrollableMessageList();

    const wideBounds = await readLayoutBounds();
    expectLayoutBounds(wideBounds);
    const wideProof = await evidence.saveJson(
      '01-wide-layout-bounds',
      wideBounds,
      'long-stream content remains within Agentic layout bounds at the default viewport',
    );

    const responsiveProofs: string[] = [];
    for (const { width, workbenchExpected } of [
      { width: 979, workbenchExpected: false },
      { width: 980, workbenchExpected: false },
      { width: 1000, workbenchExpected: false },
      { width: 1200, workbenchExpected: false },
      { width: 1280, workbenchExpected: false },
      { width: 1366, workbenchExpected: true },
    ]) {
      await page.setViewportSize({ width, height: 768 });
      await expect
        .poll(async () => ((await readLayoutBounds()).workbench?.width || 0) > 0, {
          message: `workbench visibility at ${width}px`,
          timeout: 5000,
        })
        .toBe(workbenchExpected);
      await expect(chatSlot().getByText(LONG_CONTENT_SENTINEL)).toBeVisible();
      await expect(page.locator('[data-testid^="agentic-task-row-"]').first()).toBeVisible({ timeout: 5000 });
      await waitForScrollableMessageList();

      const bounds = await readLayoutBounds();
      expectLayoutBounds(bounds, workbenchExpected);
      const proof = await evidence.saveJson(
        `02-responsive-${width}px`,
        bounds,
        workbenchExpected
          ? 'the workbench returns with readable Explorer and conversation widths at 1366px'
          : `the workbench remains collapsed and the conversation stays usable at ${width}px`,
      );
      if (proof) {
        responsiveProofs.push(proof);
      }
    }

    await page.locator('#agentic-chat-panel-header-maximize [role="button"]').first().click();
    await page.waitForFunction(() => !document.querySelector('#workbench-editor'));
    await page.setViewportSize({ width: 979, height: 768 });
    await page.waitForFunction(() => !document.querySelector('#workbench-editor'));
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid^="agentic-task-row-"]').first()).toBeVisible({ timeout: 5000 });

    const hiddenPreferenceBounds = await readLayoutBounds();
    expectLayoutBounds(hiddenPreferenceBounds, false);
    const hiddenPreferenceProof = await evidence.saveJson(
      '03-hidden-preference-layout-bounds',
      hiddenPreferenceBounds,
      'an explicitly hidden workbench remains hidden after a responsive viewport round trip',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Long deterministic stream content stays inside the Agentic chat bounds.',
      status: 'pass',
      evidence: [wideProof, ...responsiveProofs, hiddenPreferenceProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'The long message list remains scrollable without overlapping the input.',
      status: 'pass',
      evidence: [wideProof, ...responsiveProofs, hiddenPreferenceProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement:
        'The workbench remains collapsed throughout the mid-width dead zone and restores with readable panes at 1366px.',
      status: 'pass',
      evidence: [...responsiveProofs, hiddenPreferenceProof].filter(Boolean) as string[],
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
