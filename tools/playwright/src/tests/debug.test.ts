import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OPENSUMI_VIEW_CONTAINERS } from '../constans';
import { OpenSumiDebugView } from '../debug-view';
import { OpenSumiExplorerView } from '../explorer-view';
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
    workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('Debug breakpoint editor glyph margin should be worked', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'index.js', false);
    const glyphMarginModel = await editor.getGlyphMarginModel();
    let overlay = await glyphMarginModel.getOverlay(16);
    await overlay?.click({ position: { x: 9, y: 9 }, force: true });
    // 此时元素 dom 结构已经改变，需要重新获取
    overlay = await glyphMarginModel.getOverlay(16);
    expect(await glyphMarginModel.hasBreakpoint(overlay!)).toBeTruthy();
  });

  test('Debug breakpoint editor glyph margin should be worked', async () => {});
});
