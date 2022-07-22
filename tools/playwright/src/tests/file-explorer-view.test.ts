import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiView } from '../view';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let fileTreeView: OpenSumiView;
let outlineView: OpenSumiView;
let openedEditorView: OpenSumiView;

test.describe('OpenSumi Explorer Panel', () => {
  test.beforeAll(async () => {
    const workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    fileTreeView = new OpenSumiView(app, {
      viewSelector: '[class ^="file_tree__"]',
      tabSelector: '[tabindex="0"]',
      name: workspace.workspace.displayName,
    });
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('[FileTree] show file explorer', async () => {
    expect(explorer.isVisible()).toBeTruthy();
    await fileTreeView.open();
    expect(fileTreeView.isVisible()).toBeTruthy();
  });

  // test('[FileTree] should show filetree explorer', async () => {
  //   expect(explorer.isVisible()).toBeTruthy();
  //   await fileTreeView.open();
  //   expect(fileTreeView.isVisible()).toBeTruthy();
  // });

  // test.describe('OpenedEditor Explorer View', () => {

  // });

  // test.describe('Outline Explorer View', () => {

  // });
});
