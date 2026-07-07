import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiSCMView } from '../scm-view';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

const execFileAsync = promisify(execFile);

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let scm: OpenSumiSCMView;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi Extension', () => {
  // 用 git 插件来验证扩展相关功能
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/git-workspace')]);
    await workspace.initWorksapce();
    await execFileAsync('git', ['init'], { cwd: workspace.workspace.codeUri.fsPath });
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('The scm TreeNode view need show', async () => {
    scm = await app.open(OpenSumiSCMView);
    await scm.open();
    const node = await scm.scmView.waitForTreeNode();
    expect(node).toBeTruthy();
  });

  test('The scm TreeNode view need reShow', async () => {
    scm = await app.open(OpenSumiSCMView);
    await scm.open();
    await app.quickCommandPalette.trigger('Restart Extension Host Process');
    await expect.poll(async () => scm.scmView.getTreeNode()).toBeNull();
    const newNode = await scm.scmView.waitForTreeNode();
    expect(newNode).toBeTruthy();
  });
});
