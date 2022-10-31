import path from 'path';

import { expect } from '@playwright/test';

import { isWindows } from '@opensumi/ide-utils';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiFileTreeView } from '../filetree-view';
import { OpenSumiOpenedEditorView } from '../opened-editor-view';
import { OpenSumiTerminal } from '../terminal';
import { OpenSumiTextEditor } from '../text-editor';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let fileTreeView: OpenSumiFileTreeView;
let openedEditorView: OpenSumiOpenedEditorView;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi Explorer Panel', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
    openedEditorView = explorer.openedEditorView;
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
    const node = await explorer.getFileStatTreeNodeByPath('editor.js');
    await node?.open();
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
    await app.page.waitForTimeout(200);
    const newFile = await explorer.getFileStatTreeNodeByPath(`${newFileName}`);
    expect(newFile).toBeDefined();
    expect(await newFile?.isFolder()).toBeFalsy();
  });

  test('can new folder from toolbar', async () => {
    const node = await explorer.getFileStatTreeNodeByPath('editor.js');
    await node?.open();
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
    const newFile = await explorer.getFileStatTreeNodeByPath(`${newFileName}`);
    expect(newFile).toBeDefined();
    expect(await newFile?.isFolder()).toBeTruthy();
  });

  (isWindows ? test.skip : test)('fileTree should be updated while create directory from terminal', async () => {
    const dirname = 'dir_from_terminal';
    const terminal = await app.open(OpenSumiTerminal);
    await terminal.sendText(`cd ${workspace.workspace.codeUri.fsPath}`);
    await terminal.sendText(`mkdir ${dirname}`);
    await app.page.waitForTimeout(2000);
    let newDir = await explorer.getFileStatTreeNodeByPath(dirname);
    if (!newDir) {
      const action = await fileTreeView.getTitleActionByName('Refresh');
      await action?.click();
      await app.page.waitForTimeout(200);
      newDir = await explorer.getFileStatTreeNodeByPath(dirname);
    }
    expect(newDir).toBeDefined();
  });

  test('can filter files on the filetree', async () => {
    const action = await fileTreeView.getTitleActionByName('Filter on opened files');
    await action?.click();
    // type `editor2` to filter existed files
    const filterString = 'editor2';
    const input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(filterString, { delay: 200 });
    }
    await app.page.waitForTimeout(200);
    const file_1 = await explorer.getFileStatTreeNodeByPath(`${filterString}.js`);
    expect(file_1).toBeDefined();
    let file_2 = await explorer.getFileStatTreeNodeByPath('editor.js');
    expect(file_2).toBeUndefined();
    await app.page.keyboard.press('Escape');
    file_2 = await explorer.getFileStatTreeNodeByPath('editor.js');
    expect(file_2).toBeDefined();
  });

  test('should show opened files on the opened editor panel', async () => {
    await openedEditorView.open();
    expect(await openedEditorView.isVisible()).toBeTruthy();
    const testFilePath = 'editor.js';
    await app.openEditor(OpenSumiTextEditor, explorer, testFilePath);
    await app.page.waitForTimeout(500);
    const node = await explorer.getOpenedEditorTreeNodeByPath(testFilePath);
    expect(node).toBeDefined();
  });

  test('should show dirty icon on the opened editor panel', async () => {
    await openedEditorView.open();
    expect(await openedEditorView.isVisible()).toBeTruthy();
    const testFilePath = 'editor3.js';
    const editor = await app.openEditor(OpenSumiTextEditor, explorer, testFilePath);
    await editor.addTextToNewLineAfterLineByLineNumber(
      1,
      `const a = 'a';
console.log(a);`,
    );
    await app.page.waitForTimeout(1000);
    let node = await explorer.getOpenedEditorTreeNodeByPath(testFilePath);
    expect(await node?.isDirty()).toBeTruthy();
    await editor.save();
    await app.page.waitForTimeout(1000);
    node = await explorer.getOpenedEditorTreeNodeByPath(testFilePath);
    expect(await node?.isDirty()).toBeFalsy();
  });

  test('split file on the editor should showing on two group', async () => {
    await openedEditorView.open();
    expect(await openedEditorView.isVisible()).toBeTruthy();
    const testFilePath = 'editor3.js';
    const editor = await app.openEditor(OpenSumiTextEditor, explorer, testFilePath);
    await editor.triggerTitleMenuById('editor.splitToRight');
    await app.page.waitForTimeout(2000);
    const group1 = await explorer.getOpenedEditorTreeNodeByPath('Group 1');
    const group2 = await explorer.getOpenedEditorTreeNodeByPath('Group 2');
    expect(group1).toBeDefined();
    expect(group2).toBeDefined();
  });
});
