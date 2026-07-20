// Source: test/bdd/acp-layout-switch.scenario.md

import { expect } from '@playwright/test';

import { OpenSumiExplorerView } from '../explorer-view';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForExplorerViewVisible,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

let runtime: AcpBddFixtureRuntime;

interface LayoutGeometry {
  chat?: { x: number; width: number; right: number };
  workbench?: { x: number; width: number; right: number };
  explorerVisible: boolean;
  url: string;
}

async function readGeometry(): Promise<LayoutGeometry> {
  return page.evaluate(() => {
    const chat = document.querySelector('.AI-Chat-slot')?.getBoundingClientRect();
    const workbench = document.querySelector('#workbench-editor')?.getBoundingClientRect();
    const explorer = Array.from(document.querySelectorAll('[data-viewlet-id="explorer"]')).find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    return {
      chat: chat ? { x: chat.x, width: chat.width, right: chat.right } : undefined,
      workbench: workbench ? { x: workbench.x, width: workbench.width, right: workbench.right } : undefined,
      explorerVisible: Boolean(explorer),
      url: window.location.href,
    };
  });
}

async function dragChatSplitter(targetX: number) {
  const handle = await page.evaluate(() => {
    const chat = document.querySelector('.AI-Chat-slot')?.getBoundingClientRect();
    if (!chat) {
      return undefined;
    }
    const boundary = chat.x < window.innerWidth / 2 ? chat.right : chat.left;
    return Array.from(document.querySelectorAll('.design-slot_resize_horizontal'))
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        distance: Math.abs(rect.x + rect.width / 2 - boundary),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
  });
  if (!handle) {
    throw new Error('未找到 AI Chat 与 workbench 之间的可见 splitter');
  }
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

async function openEditorJs() {
  await waitForExplorerViewVisible(page);
  const explorer = await runtime.app.open(OpenSumiExplorerView);
  explorer.initFileTreeView(runtime.workspace.workspace.displayName);
  const editorNode = await explorer.getFileStatTreeNodeByPath('editor.js');
  expect(editorNode).toBeDefined();
  await editorNode!.open();
  await expect(page.getByText('editor.js', { exact: true }).last()).toBeVisible();
}

async function switchLayoutByMenu(target: 'Agent' | 'Classic') {
  await page.locator('#opensumi-menubar').getByText('View', { exact: true }).click();
  const panelLayout = page.getByText('Panel Layout', { exact: true }).last();
  await expect(panelLayout).toBeVisible();
  await panelLayout.hover();
  const targetLabel = page.getByText(target, { exact: true }).last();
  const targetItem = targetLabel.locator('xpath=ancestor::li[contains(@class,"kt-inner-menu-item")][1]');
  await expect(targetItem).toBeVisible();
  await targetItem.click();
}

test.describe('ACP 布局切换', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'default',
      panelLayout: 'agentic',
      writePanelLayoutPreference: false,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1800, height: 1000 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('通过用户入口在 Agent 与 Classic 间往返，并限制各自的 Chat 宽度', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-layout-switch', {
      sourceScenario: 'test/bdd/acp-layout-switch.scenario.md',
      profile: 'default',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });
    const originalUrl = page.url();

    await openEditorJs();
    const agentInitial = await readGeometry();
    expect(agentInitial.chat?.x).toBeLessThan(agentInitial.workbench?.x ?? Number.POSITIVE_INFINITY);

    await dragChatSplitter(10);
    const agentMin = await readGeometry();
    expect(agentMin.chat?.width).toBeGreaterThanOrEqual(640);
    await dragChatSplitter(1790);
    const agentMax = await readGeometry();
    expect(agentMax.chat?.width).toBeLessThanOrEqual(1440);
    expect(agentMax.workbench?.width).toBeGreaterThanOrEqual(360);

    await switchLayoutByMenu('Classic');
    await page.waitForSelector('#main-horizontal-ai');
    const classicInitial = await readGeometry();
    expect(classicInitial.workbench?.x).toBeLessThan(classicInitial.chat?.x ?? Number.POSITIVE_INFINITY);
    expect(classicInitial.explorerVisible).toBe(true);
    expect(page.url()).toBe(originalUrl);

    await dragChatSplitter(10);
    const classicMax = await readGeometry();
    expect(classicMax.chat?.width).toBeLessThanOrEqual(1080);
    await dragChatSplitter(1790);
    const classicMin = await readGeometry();
    expect(classicMin.chat?.width).toBeGreaterThanOrEqual(280);
    await openEditorJs();

    await switchLayoutByMenu('Agent');
    await page.waitForSelector('#main-horizontal-ai-agentic');
    const agentFocused = await readGeometry();
    expect(agentFocused.chat?.width).toBeGreaterThanOrEqual(640);
    await ensureAgenticLayout(page);
    await waitForExplorerViewVisible(page);
    const agentRestored = await readGeometry();
    expect(agentRestored.chat?.x).toBeLessThan(agentRestored.workbench?.x ?? Number.POSITIVE_INFINITY);
    expect(agentRestored.chat?.width).toBeGreaterThanOrEqual(640);
    expect(agentRestored.chat?.width).toBeLessThanOrEqual(1440);
    expect(agentRestored.explorerVisible).toBe(true);
    expect(page.url()).toBe(originalUrl);

    const proof = await evidence.saveJson(
      '01-layout-switch-bounds',
      { agentInitial, agentMin, agentMax, classicInitial, classicMin, classicMax, agentFocused, agentRestored },
      'Agent/Classic 用户入口、排列、splitter 边界与 Explorer/editor 连续性',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: '布局切换不导航或重载，AI Chat 与 workbench 的左右顺序正确。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'Classic 限制为 280-1080px，Agent 限制为 640-1440px，Explorer/editor 保持可用。',
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
