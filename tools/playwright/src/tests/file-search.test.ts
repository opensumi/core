import path from 'path';

import { expect } from '@playwright/test';

import { URI } from '@opensumi/ide-utils';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiFileTreeView } from '../filetree-view';
import { OpenSumiTextEditor } from '../text-editor';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let fileTreeView: OpenSumiFileTreeView;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi File Search', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('open editor.js file', async () => {
    await explorer.open();
    expect(await explorer.isVisible()).toBeTruthy();
    await fileTreeView.open();
    expect(await fileTreeView.isVisible()).toBeTruthy();
    // Open editor3.js first
    const testFilePath = 'editor3.js';
    const editor = await app.openEditor(OpenSumiTextEditor, explorer, testFilePath);
    let currentTab = await editor.getCurrentTab();
    let dataUri = await currentTab?.getAttribute('data-uri');
    expect(dataUri).toBeDefined();
    if (dataUri) {
      expect(new URI(dataUri).displayName).toBe(testFilePath);
    }

    const openFileName = 'editor.js';
    await app.quickOpenPalette.open();
    await app.quickOpenPalette.type(openFileName);
    // Just enter
    await app.page.keyboard.press('Enter');
    await app.page.waitForTimeout(500);

    currentTab = await editor.getCurrentTab();
    dataUri = await currentTab?.getAttribute('data-uri');
    expect(dataUri).toBeDefined();
    if (dataUri) {
      expect(new URI(dataUri).displayName).toBe(openFileName);
    }
  });
});
