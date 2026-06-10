import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiDebugConsoleView } from '../debug-console-view';
import { OpenSumiDebugView } from '../debug-view';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiTerminalView } from '../terminal-view';
import { OpenSumiTextEditor } from '../text-editor';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let debugView: OpenSumiDebugView;
let editor: OpenSumiTextEditor;
let workspace: OpenSumiWorkspace;

const DEBUG_BREAKPOINT_LINE = 6;

async function ensureBreakpointWidget(lineNumber = DEBUG_BREAKPOINT_LINE) {
  const glyphMarginModel = await editor.getGlyphMarginModel();
  const existingWidget = await glyphMarginModel.getGlyphMarginWidgets(lineNumber);
  if (existingWidget && (await glyphMarginModel.hasBreakpoint(existingWidget))) {
    return { glyphMarginModel, breakpointWidget: existingWidget };
  }

  const overlay = await glyphMarginModel.getOverlay(lineNumber);
  expect(overlay).toBeDefined();
  await overlay!.click({ position: { x: 9, y: 9 }, force: true });

  await expect
    .poll(
      async () => {
        const breakpointWidget = await glyphMarginModel.getGlyphMarginWidgets(lineNumber);
        return breakpointWidget ? await glyphMarginModel.hasBreakpoint(breakpointWidget) : false;
      },
      { timeout: 5000 },
    )
    .toBeTruthy();

  const breakpointWidget = await glyphMarginModel.getGlyphMarginWidgets(lineNumber);
  expect(breakpointWidget).toBeDefined();
  return { glyphMarginModel, breakpointWidget: breakpointWidget! };
}

async function expectTopStackFrame(glyphMarginModel: Awaited<ReturnType<OpenSumiTextEditor['getGlyphMarginModel']>>) {
  await expect
    .poll(
      async () => {
        const topStackFrameNode = await glyphMarginModel.getGlyphMarginWidgets(DEBUG_BREAKPOINT_LINE);
        return topStackFrameNode ? await glyphMarginModel.hasTopStackFrame(topStackFrameNode) : false;
      },
      { timeout: 10_000 },
    )
    .toBeTruthy();
}

async function expectTopStackFrameLine(
  glyphMarginModel: Awaited<ReturnType<OpenSumiTextEditor['getGlyphMarginModel']>>,
) {
  const overlaysModel = await editor.getOverlaysModel();
  await expect
    .poll(
      async () => {
        const viewOverlay = await overlaysModel.getOverlay(DEBUG_BREAKPOINT_LINE);
        return viewOverlay ? await glyphMarginModel.hasTopStackFrameLine(viewOverlay) : false;
      },
      { timeout: 10_000 },
    )
    .toBeTruthy();
}

test.describe('OpenSumi Debug', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/debug')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    await explorer.fileTreeView.open();
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('Debug breakpoint editor glyph margin should be worked', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'index.js', false);
    const { glyphMarginModel, breakpointWidget } = await ensureBreakpointWidget();
    expect(await glyphMarginModel.hasBreakpoint(breakpointWidget)).toBeTruthy();
    await editor.close();
  });

  test('Run Debug should be worked', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'index.js', false);
    await app.page.waitForTimeout(1000);

    debugView = await app.open(OpenSumiDebugView);
    const { glyphMarginModel } = await ensureBreakpointWidget();

    await debugView.start();
    await expectTopStackFrame(glyphMarginModel);
    await expectTopStackFrameLine(glyphMarginModel);
    await editor.close();
    await debugView.stop();
    await page.waitForTimeout(1000);
  });

  test('ContextMenu on DebugConsole should be work', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'index.js', false);
    await app.page.waitForTimeout(1000);

    debugView = await app.open(OpenSumiDebugView);
    await ensureBreakpointWidget();

    await debugView.start();
    await app.page.waitForTimeout(2000);

    const debugConsole = await app.open(OpenSumiDebugConsoleView);
    const contextMenu = await debugConsole.openConsoleContextMenu();
    await app.page.waitForTimeout(200);
    expect(await contextMenu?.isOpen()).toBeTruthy();
    const copyAll = await contextMenu?.menuItemByName('Copy All');
    await copyAll?.click();
    await app.page.waitForTimeout(1000);
    const text = (await page.evaluate('navigator.clipboard.readText()')) as string;
    expect(text.includes('Debugger attached.')).toBeTruthy();

    await editor.close();
    await debugView.stop();
    await page.waitForTimeout(1000);
  });

  test('Run Debug by Javascript Debug Terminal', async () => {
    await explorer.open();
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'index.js', false);
    await app.page.waitForTimeout(1000);
    debugView = await app.open(OpenSumiDebugView);
    const terminal = await app.open(OpenSumiTerminalView);
    await terminal.createTerminalByType('Javascript Debug Terminal');
    const { glyphMarginModel } = await ensureBreakpointWidget();

    await terminal.sendText('node index.js');
    await expectTopStackFrame(glyphMarginModel);
    await expectTopStackFrameLine(glyphMarginModel);
    await debugView.stop();
    await page.waitForTimeout(1000);
  });
});
