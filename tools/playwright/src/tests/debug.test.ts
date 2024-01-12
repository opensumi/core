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
    const glyphMarginModel = await editor.getGlyphMarginModel();
    let overlay = await glyphMarginModel.getOverlay(6);
    await overlay?.click({ position: { x: 9, y: 9 }, force: true });
    // 此时元素 dom 结构已经改变，需要重新获取
    overlay = await glyphMarginModel.getOverlay(6);
    expect(await glyphMarginModel.hasBreakpoint(overlay!)).toBeTruthy();
    await editor.close();
  });

  test('Run Debug should be worked', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'index.js', false);
    await app.page.waitForTimeout(1000);

    debugView = await app.open(OpenSumiDebugView);
    const glyphMarginModel = await editor.getGlyphMarginModel();
    let glyphOverlay = await glyphMarginModel.getOverlay(6);
    expect(glyphOverlay).toBeDefined();
    if (!glyphOverlay) {
      return;
    }
    const isClicked = await glyphMarginModel.hasBreakpoint(glyphOverlay);
    if (!isClicked) {
      await glyphOverlay?.click({ position: { x: 9, y: 9 }, force: true });
      await app.page.waitForTimeout(1000);
    }

    await debugView.start();
    await app.page.waitForTimeout(2000);

    glyphOverlay = await glyphMarginModel.getOverlay(6);
    expect(glyphOverlay).toBeDefined();
    if (!glyphOverlay) {
      return;
    }
    expect(await glyphMarginModel.hasTopStackFrame(glyphOverlay)).toBeTruthy();

    const overlaysModel = await editor.getOverlaysModel();
    const viewOverlay = await overlaysModel.getOverlay(6);
    // get editor line 6
    expect(viewOverlay).toBeDefined();
    if (!viewOverlay) {
      return;
    }
    expect(await glyphMarginModel.hasTopStackFrameLine(viewOverlay)).toBeTruthy();
    await editor.close();
    await debugView.stop();
    await page.waitForTimeout(1000);
  });

  test('ContextMenu on DebugConsole should be work', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'index.js', false);
    await app.page.waitForTimeout(1000);

    debugView = await app.open(OpenSumiDebugView);
    const glyphMarginModel = await editor.getGlyphMarginModel();
    // get editor line 6
    const glyphOverlay = await glyphMarginModel.getOverlay(6);
    expect(glyphOverlay).toBeDefined();
    if (!glyphOverlay) {
      return;
    }
    const isClicked = await glyphMarginModel.hasBreakpoint(glyphOverlay);
    if (!isClicked) {
      await glyphOverlay?.click({ position: { x: 9, y: 9 }, force: true });
      await app.page.waitForTimeout(1000);
    }

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
    const glyphMarginModel = await editor.getGlyphMarginModel();
    let glyphOverlay = await glyphMarginModel.getOverlay(6);
    expect(glyphOverlay).toBeDefined();
    if (!glyphOverlay) {
      return;
    }
    const isClicked = await glyphMarginModel.hasBreakpoint(glyphOverlay);
    if (!isClicked) {
      await glyphOverlay?.click({ position: { x: 9, y: 9 }, force: true });
      await app.page.waitForTimeout(1000);
    }

    await terminal.sendText('node index.js');
    await app.page.waitForTimeout(2000);

    // get editor line 6
    glyphOverlay = await glyphMarginModel.getOverlay(6);
    expect(glyphOverlay).toBeDefined();
    if (!glyphOverlay) {
      return;
    }
    expect(await glyphMarginModel.hasTopStackFrame(glyphOverlay)).toBeTruthy();

    const overlaysModel = await editor.getOverlaysModel();
    const viewOverlay = await overlaysModel.getOverlay(6);
    expect(viewOverlay).toBeDefined();
    if (!viewOverlay) {
      return;
    }
    expect(await glyphMarginModel.hasTopStackFrameLine(viewOverlay)).toBeTruthy();
    await debugView.stop();
    await page.waitForTimeout(1000);
  });
});
