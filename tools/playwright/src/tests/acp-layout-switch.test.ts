import path from 'path';

import { Page, expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiFileTreeView } from '../filetree-view';
import { OpenSumiTextEditor } from '../text-editor';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

type PanelLayoutMode = 'classic' | 'agentic';

interface WebMcpToolInfo {
  name: string;
}

interface WebMcpAvailability {
  available: boolean;
  reason?: string;
  tools: string[];
}

interface OptionalToolCall {
  name: string;
  skipped: boolean;
  reason?: string;
  result?: any;
}

interface ElementBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let fileTreeView: OpenSumiFileTreeView;
let workspace: OpenSumiWorkspace;

const AI_CHAT_SLOT_SELECTOR = '.AI-Chat-slot';
const EXPLORER_SELECTOR = '[data-viewlet-id="explorer"]';
const VISIBLE_DROPDOWN_SELECTOR = '.kt-dropdown:not(.kt-dropdown-hidden)';
const HORIZONTAL_RESIZE_HANDLE_SELECTOR = '[class*="resize-handle-horizontal"]';

async function getWebMcpAvailability(target: Page): Promise<WebMcpAvailability> {
  return target.evaluate(() => {
    const modelContext = (navigator as any).modelContext;
    if (!modelContext) {
      return {
        available: false,
        reason: 'navigator.modelContext missing',
        tools: [],
      };
    }
    if (typeof modelContext.getTools !== 'function') {
      return {
        available: false,
        reason: 'navigator.modelContext.getTools missing',
        tools: [],
      };
    }
    if (typeof modelContext.executeTool !== 'function') {
      return {
        available: false,
        reason: 'navigator.modelContext.executeTool missing',
        tools: [],
      };
    }
    return {
      available: true,
      tools: modelContext
        .getTools()
        .map((tool: WebMcpToolInfo) => tool.name)
        .sort(),
    };
  });
}

async function executeWebMcpTool(target: Page, name: string, args: Record<string, unknown> = {}) {
  return target.evaluate(
    async ({ toolName, toolArgs }) => (navigator as any).modelContext.executeTool(toolName, toolArgs),
    { toolName: name, toolArgs: args },
  );
}

async function callOptionalWebMcpTool(
  target: Page,
  tools: Set<string>,
  name: string,
  args: Record<string, unknown> = {},
): Promise<OptionalToolCall> {
  if (!tools.has(name)) {
    return {
      name,
      skipped: true,
      reason: 'tool is not exposed by the active WebMCP profile',
    };
  }

  const result = await executeWebMcpTool(target, name, args);
  expect(result?.success, `${name} should return a successful WebMCP result`).toBe(true);
  return { name, skipped: false, result };
}

async function assertWebMcpReadState(target: Page, label: string): Promise<OptionalToolCall[]> {
  const availability = await getWebMcpAvailability(target);
  expect(availability.available, availability.reason).toBe(true);
  expect(
    availability.tools.filter((tool) => tool.startsWith('_opensumi/')),
    `${label}: legacy WebMCP tool names must not be exposed`,
  ).toEqual([]);

  const tools = new Set(availability.tools);
  const calls: OptionalToolCall[] = [];

  calls.push(await callOptionalWebMcpTool(target, tools, 'acp_chat_showChatView'));
  calls.push(await callOptionalWebMcpTool(target, tools, 'workspace_getInfo'));
  calls.push(await callOptionalWebMcpTool(target, tools, 'editor_getActive'));

  const fileExists = await callOptionalWebMcpTool(target, tools, 'file_exists', { path: 'editor.js' });
  calls.push(fileExists);
  if (!fileExists.skipped) {
    expect(fileExists.result?.result?.exists, `${label}: editor.js should exist`).toBe(true);
  }

  if (tools.has('file_exists') && tools.has('file_read')) {
    const packageExists = await executeWebMcpTool(target, 'file_exists', { path: 'package.json' });
    expect(packageExists?.success, `${label}: package.json existence check should succeed`).toBe(true);
    if (packageExists?.result?.exists) {
      calls.push(await callOptionalWebMcpTool(target, tools, 'file_read', { path: 'package.json', maxBytes: 4096 }));
    }
  } else {
    calls.push({
      name: 'file_read',
      skipped: true,
      reason: 'file_read or file_exists is not exposed by the active WebMCP profile',
    });
  }

  return calls;
}

async function showAcpChatView(target: Page): Promise<void> {
  const availability = await getWebMcpAvailability(target);
  expect(availability.available, availability.reason).toBe(true);
  expect(availability.tools, 'acp_chat_showChatView should be exposed for ACP layout tests').toContain(
    'acp_chat_showChatView',
  );

  const result = await executeWebMcpTool(target, 'acp_chat_showChatView');
  expect(result?.success, 'acp_chat_showChatView should show the AI chat panel').toBe(true);
  await target.waitForSelector(AI_CHAT_SLOT_SELECTOR, { state: 'visible' });
}

async function clickMenuItem(target: Page, label: string): Promise<void> {
  const item = target.locator(VISIBLE_DROPDOWN_SELECTOR).locator('.kt-inner-menu-item', { hasText: label });
  await expect(item, `menu item "${label}" should be visible`).toHaveCount(1);
  await item.click();
}

async function getElementBox(target: Page, selector: string): Promise<ElementBox> {
  const box = await target.evaluate((elementSelector) => {
    const element = document.querySelector(elementSelector);
    if (!element) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }, selector);

  expect(box, `${selector} should exist`).not.toBeNull();
  return box!;
}

async function dragHorizontalHandleNear(target: Page, boundaryX: number, deltaX: number): Promise<void> {
  const handleBox = await target.evaluate(
    ({ handleSelector, targetX }) => {
      const handles = Array.from(document.querySelectorAll(handleSelector));
      const candidates = handles
        .map((handle) => {
          const rect = handle.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            distance: Math.abs(rect.left + rect.width / 2 - targetX),
          };
        })
        .filter((rect) => rect.width > 0 && rect.height > 0);

      candidates.sort((left, right) => left.distance - right.distance);
      return candidates[0] || null;
    },
    { handleSelector: HORIZONTAL_RESIZE_HANDLE_SELECTOR, targetX: boundaryX },
  );

  expect(handleBox, `resize handle near ${boundaryX} should be visible`).not.toBeNull();

  const startX = handleBox!.left + handleBox!.width / 2;
  const startY = handleBox!.top + handleBox!.height / 2;
  await target.mouse.move(startX, startY);
  await target.mouse.down();
  await target.mouse.move(startX + deltaX, startY, { steps: 10 });
  await target.mouse.up();
}

async function assertResizeBoundaries(target: Page, mode: PanelLayoutMode): Promise<void> {
  const aiChatBefore = await getElementBox(target, AI_CHAT_SLOT_SELECTOR);
  const boundaryX = mode === 'agentic' ? aiChatBefore.right : aiChatBefore.left;
  const deltaX = mode === 'agentic' ? -1200 : 1200;

  await dragHorizontalHandleNear(target, boundaryX, deltaX);
  await target.waitForFunction(
    ({ selector, expectedMin }) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return !!rect && rect.width >= expectedMin;
    },
    { selector: AI_CHAT_SLOT_SELECTOR, expectedMin: mode === 'agentic' ? 640 : 280 },
  );

  const aiChatAfterMinDrag = await getElementBox(target, AI_CHAT_SLOT_SELECTOR);
  expect(aiChatAfterMinDrag.width, `${mode}: AI chat should respect min resize`).toBeGreaterThanOrEqual(
    mode === 'agentic' ? 640 : 280,
  );

  const expandBoundaryX = mode === 'agentic' ? aiChatAfterMinDrag.right : aiChatAfterMinDrag.left;
  await dragHorizontalHandleNear(target, expandBoundaryX, mode === 'agentic' ? 1200 : -1200);

  await target.waitForFunction(
    ({ selector, expectedMax }) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return !!rect && rect.width <= expectedMax;
    },
    { selector: AI_CHAT_SLOT_SELECTOR, expectedMax: mode === 'agentic' ? 1440 : 1080 },
  );

  const aiChatAfterMaxDrag = await getElementBox(target, AI_CHAT_SLOT_SELECTOR);
  expect(aiChatAfterMaxDrag.width, `${mode}: AI chat should respect max resize`).toBeLessThanOrEqual(
    mode === 'agentic' ? 1440 : 1080,
  );
}

async function setPanelLayoutFromMenu(target: Page, mode: PanelLayoutMode): Promise<void> {
  const viewMenu = target.locator('#opensumi-menubar [class^="menubar___"]', { hasText: 'View' });
  await expect(viewMenu, 'View menu should be visible').toHaveCount(1);
  await viewMenu.click();

  const panelLayoutItem = target
    .locator(VISIBLE_DROPDOWN_SELECTOR)
    .locator('.kt-inner-menu-item', { hasText: 'Panel Layout' });
  await expect(panelLayoutItem, 'Panel Layout submenu should be visible').toHaveCount(1);
  await panelLayoutItem.hover();
  await target.waitForTimeout(100);

  await clickMenuItem(target, mode === 'agentic' ? 'Agentic' : 'Classic');
}

async function assertLayoutOrder(target: Page, mode: PanelLayoutMode): Promise<void> {
  await target.waitForFunction(
    ({ aiChatSelector, explorerSelector, expectedMode }) => {
      const aiChatRect = document.querySelector(aiChatSelector)?.getBoundingClientRect();
      const explorerRect = document.querySelector(explorerSelector)?.getBoundingClientRect();
      if (!aiChatRect || !explorerRect || aiChatRect.width <= 0 || explorerRect.width <= 0) {
        return false;
      }
      return expectedMode === 'agentic' ? aiChatRect.left < explorerRect.left : explorerRect.left < aiChatRect.left;
    },
    { aiChatSelector: AI_CHAT_SLOT_SELECTOR, explorerSelector: EXPLORER_SELECTOR, expectedMode: mode },
  );

  const boxes = await target.evaluate(
    ({ aiChatSelector, explorerSelector }) => {
      const toBox = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      };
      return {
        aiChat: toBox(aiChatSelector),
        explorer: toBox(explorerSelector),
      };
    },
    { aiChatSelector: AI_CHAT_SLOT_SELECTOR, explorerSelector: EXPLORER_SELECTOR },
  );

  expect(boxes.aiChat.width, `${mode}: AI chat should be visible`).toBeGreaterThan(0);
  expect(boxes.explorer.width, `${mode}: Explorer should be visible`).toBeGreaterThan(0);
  if (mode === 'agentic') {
    expect(boxes.aiChat.left, 'agentic layout should place AI chat before Explorer').toBeLessThan(boxes.explorer.left);
  } else {
    expect(boxes.explorer.left, 'classic layout should place Explorer before AI chat').toBeLessThan(boxes.aiChat.left);
  }
}

async function assertExplorerInteraction(filePath: string): Promise<void> {
  await explorer.open();
  await fileTreeView.open();
  await expect(page.locator(EXPLORER_SELECTOR), 'Explorer should remain visible').toBeVisible();

  const folder = await explorer.getFileStatTreeNodeByPath('test');
  expect(folder, 'test folder should be visible in Explorer').toBeDefined();
  await folder?.expand();
  expect(await folder?.isCollapsed()).toBe(false);

  const editor = await app.openEditor(OpenSumiTextEditor, explorer, filePath);
  await expect(page.locator('#opensumi-editor'), `${filePath} should open in the editor`).toBeVisible();
  expect(await editor.getCurrentTab(), `${filePath} should have an active editor tab`).toBeTruthy();
}

test.describe('ACP Layout Switch - CDP and WebMCP', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('keeps ACP chat, WebMCP, and Explorer usable while switching layouts', async () => {
    const initialUrl = page.url();
    await page.waitForSelector('#main', { state: 'visible' });
    await page.waitForSelector('.loading_indicator', { state: 'detached' });
    await expect(page.locator('body')).toContainText(/Explorer/i);

    await showAcpChatView(page);
    await assertWebMcpReadState(page, 'initial');

    await setPanelLayoutFromMenu(page, 'classic');
    await assertLayoutOrder(page, 'classic');
    await assertResizeBoundaries(page, 'classic');
    await assertExplorerInteraction('test/test.js');
    await assertWebMcpReadState(page, 'classic');

    await setPanelLayoutFromMenu(page, 'agentic');
    await assertLayoutOrder(page, 'agentic');
    await assertResizeBoundaries(page, 'agentic');
    await assertExplorerInteraction('editor.js');
    await assertWebMcpReadState(page, 'agentic');

    expect(page.url(), 'layout switching should not navigate or reload the workspace URL').toBe(initialUrl);
  });
});
