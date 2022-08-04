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

test.describe('OpenSumi Explorer Panel', () => {
  test.beforeAll(async () => {
    const workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('should show file explorer', async () => {
    expect(explorer.isVisible()).toBeTruthy();
    await fileTreeView.open();
    expect(fileTreeView.isVisible()).toBeTruthy();
  });

  test('can new single file by context menu', async () => {
    expect(explorer.isVisible()).toBeTruthy();
    await fileTreeView.open();
    expect(fileTreeView.isVisible()).toBeTruthy();
    const node = await explorer.getFileStatTreeNodeByPath('test');
    await node?.expand();
    expect(await node?.isCollapsed()).toBeFalsy();
    const menu = await node?.openContextMenu();
    expect(await menu?.isOpen()).toBeTruthy();
    const newFileMenu = await menu?.menuItemByIndex(0);
    await newFileMenu?.click();
    // type `new_file` as the file name
    const newFileName = 'new_file';
    const input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    const newFile = await explorer.getFileStatTreeNodeByPath(`test/${newFileName}`);
    expect(newFile).toBeDefined();
    expect(await newFile?.isFolder()).toBeFalsy();
  });

  test('can new folder by context menu', async () => {
    expect(explorer.isVisible()).toBeTruthy();
    await fileTreeView.open();
    expect(fileTreeView.isVisible()).toBeTruthy();
    const node = await explorer.getFileStatTreeNodeByPath('test');
    await node?.expand();
    expect(await node?.isCollapsed()).toBeFalsy();
    const menu = await node?.openContextMenu();
    expect(await menu?.isOpen()).toBeTruthy();
    const newFileMenu = await menu?.menuItemByName('New Folder');
    await newFileMenu?.click();
    // type `new_file` as the file name
    const newFileName = 'new_Folder';
    const input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    const newFile = await explorer.getFileStatTreeNodeByPath(`test/${newFileName}`);
    expect(newFile).toBeDefined();
    expect(await newFile?.isFolder()).toBeTruthy();
  });
});
