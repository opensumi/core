import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiFileTreeView } from '../filetree-view';
import { OpenSumiTerminal } from '../terminal';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let fileTreeView: OpenSumiFileTreeView;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi SCM Panel', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/git-workspace')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('The "U" charset should on the files tail after git initialized', async () => {
    await explorer.fileTreeView.open();
    const terminal = await app.open(OpenSumiTerminal);
    // There should have GIT on the PATH
    await terminal.sendText('git init');
    const action = await fileTreeView.getTitleActionByName('Refresh');
    await action?.click();
    await app.page.waitForTimeout(2000);
    const node = await explorer.getFileStatTreeNodeByPath('a.js');
    const badge = await node?.badge();
    expect(badge).toBe('U');
  });
});
