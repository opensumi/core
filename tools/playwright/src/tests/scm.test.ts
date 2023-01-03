import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiDiffEditor } from '../diff-editor';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiFileTreeView } from '../filetree-view';
import { OpenSumiSCMView } from '../scm-view';
import { OpenSumiTerminalView } from '../terminal-view';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let scm: OpenSumiSCMView;
let fileTreeView: OpenSumiFileTreeView;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi SCM Panel', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/git-workspace')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
    const terminal = await app.open(OpenSumiTerminalView);
    // There should have GIT on the PATH
    await terminal.sendText('git init');
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('The "U" charset should on the files tail after git initialized', async () => {
    await explorer.fileTreeView.open();
    const action = await fileTreeView.getTitleActionByName('Refresh');
    await action?.click();
    await app.page.waitForTimeout(2000);
    const node = await explorer.getFileStatTreeNodeByPath('a.js');
    const badge = await node?.badge();
    expect(badge).toBe('U');
  });

  test('The "U" charset should on the files tail on SCM view', async () => {
    scm = await app.open(OpenSumiSCMView);
    await scm.open();
    await app.page.waitForTimeout(2000);
    const node = await scm.getFileStatTreeNodeByPath('a.js');
    const badge = await node?.getBadge();
    expect(badge).toBe('U');
  });

  test('Open file from context menu', async () => {
    scm = await app.open(OpenSumiSCMView);
    await scm.open();
    const node = await scm.getFileStatTreeNodeByPath('a.js');
    const item = await node?.getMenuItemByName('Open File');
    await item?.click();
    await app.page.waitForTimeout(1000);
    if (node) {
      const editor = new OpenSumiDiffEditor(app, node);
      const currentTab = await editor.getCurrentTab();
      const dataUri = await currentTab?.getAttribute('data-uri');
      expect(dataUri?.startsWith('file')).toBeTruthy();
    }
  });

  test('Open file with diff editor', async () => {
    scm = await app.open(OpenSumiSCMView);
    await scm.open();
    const node = await scm.getFileStatTreeNodeByPath('a.js');
    await node?.open();
    await app.page.waitForTimeout(1000);
    if (node) {
      const editor = new OpenSumiDiffEditor(app, node);
      const currentTab = await editor.getCurrentTab();
      const dataUri = await currentTab?.getAttribute('data-uri');
      expect(dataUri?.startsWith('diff')).toBeTruthy();
    }
  });
});
