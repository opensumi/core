import path from 'path';

import { expect } from '@playwright/test';

import { isWindows } from '@opensumi/ide-utils';

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

test.describe('OpenSumi Explorer Panel', () => {
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

  test('should show file explorer', async () => {
    expect(explorer.isVisible()).toBeTruthy();
    await fileTreeView.open();
    expect(await fileTreeView.isVisible()).toBeTruthy();
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
    await app.page.waitForTimeout(200);
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
    const newFileName = 'new_folder';
    const input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    await app.page.waitForTimeout(200);
    const newFile = await explorer.getFileStatTreeNodeByPath(`test/${newFileName}`);
    expect(newFile).toBeDefined();
    expect(await newFile?.isFolder()).toBeTruthy();
  });

  test('can new file from toolbar', async () => {
    expect(explorer.isVisible()).toBeTruthy();
    await fileTreeView.open();
    expect(fileTreeView.isVisible()).toBeTruthy();
    const action = await fileTreeView.getTitleActionByName('New File');
    await action?.click();
    // type `new_file` as the file name
    const newFileName = 'new_file2';
    const input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
  });

  test('can new folder from toolbar', async () => {
    expect(explorer.isVisible()).toBeTruthy();
    await fileTreeView.open();
    expect(fileTreeView.isVisible()).toBeTruthy();
    const action = await fileTreeView.getTitleActionByName('New Folder');
    await action?.click();
    // type `new_folder2` as the file name
    const newFileName = 'new_folder2';
    const input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    await app.page.waitForTimeout(200);
    const newFile = await explorer.getFileStatTreeNodeByPath(`test/${newFileName}`);
    expect(newFile).toBeDefined();
    expect(await newFile?.isFolder()).toBeTruthy();
  });

  (isWindows ? test.skip : test)('fileTree should be updated while create directory from terminal', async () => {
    const dirname = 'dir_from_terminal';
    const terminal = await app.open(OpenSumiTerminal);
    await terminal.sendText(`cd ${workspace.workspace.codeUri.fsPath}`);
    await terminal.sendText(`mkdir ${dirname}`);
    await app.page.waitForTimeout(2000);
    const newDir = await explorer.getFileStatTreeNodeByPath(dirname);
    expect(newDir).toBeDefined();
  });
});
