import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiSCMView } from '../scm-view';
import { OpenSumiTerminalView } from '../terminal-view';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let scm: OpenSumiSCMView;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi Extension', () => {
  // 用 git 插件来验证扩展相关功能
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/git-workspace')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    const terminal = await app.open(OpenSumiTerminalView);
    // There should have GIT on the PATH
    await terminal.sendText('git init');
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('The scm TreeNode view need show', async () => {
    scm = await app.open(OpenSumiSCMView);
    await scm.open();
    await app.page.waitForTimeout(2000);
    const node = await scm.scmView.getTreeNode();
    expect(node).toBeTruthy();
  });

  test('The scm TreeNode view need reShow', async () => {
    scm = await app.open(OpenSumiSCMView);
    await scm.open();
    await app.quickCommandPalette.trigger('Restart Extension Host Process');
    await app.page.waitForTimeout(4000);
    const node = await scm.scmView.getTreeNode();
    expect(node).toBeNull();
    await app.page.waitForTimeout(4000);
    const newNode = await scm.scmView.getTreeNode();
    expect(newNode).toBeTruthy();
  });
});
