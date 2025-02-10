import path from 'path';

import { expect } from '@playwright/test';

import { isMacintosh, isWindows } from '@opensumi/ide-utils';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiFileTreeView } from '../filetree-view';
import { OpenSumiOpenedEditorView } from '../opened-editor-view';
import { OpenSumiOutlineView } from '../outline-view';
import { OpenSumiTerminalView } from '../terminal-view';
import { OpenSumiTextEditor } from '../text-editor';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let fileTreeView: OpenSumiFileTreeView;
let openedEditorView: OpenSumiOpenedEditorView;
let outlineView: OpenSumiOutlineView;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi Explorer Panel', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
    outlineView = explorer.outlineView;
    openedEditorView = explorer.openedEditorView;
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('should show file explorer', async () => {
    expect(await explorer.isVisible()).toBeTruthy();
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
    const terminal = await app.open(OpenSumiTerminalView);
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

  test('the open state of the editor should be restored after refreshing', async () => {
    await openedEditorView.open();
    const testFilePath_1 = 'editor2.js';
    const testFilePath_2 = 'editor3.js';
    // Close All Edtior Tabs
    const editor = await app.openEditor(OpenSumiTextEditor, explorer, testFilePath_1);
    await app.page.waitForTimeout(1000);
    let node = await explorer.getOpenedEditorTreeNodeByPath(testFilePath_1);
    expect(node).toBeDefined();
    const contextMenu = await editor.openTabContextMenu();
    expect(await contextMenu?.isOpen()).toBeTruthy();
    const closeAll = await contextMenu?.menuItemByName('Close All');
    await closeAll?.click();
    await app.page.waitForTimeout(1000);
    node = await explorer.getOpenedEditorTreeNodeByPath(testFilePath_1);
    expect(node).toBeUndefined();
    // Open File
    await app.openEditor(OpenSumiTextEditor, explorer, testFilePath_1, false);
    await app.openEditor(OpenSumiTextEditor, explorer, testFilePath_2, false);
    await app.page.waitForTimeout(1000);
    node = await explorer.getOpenedEditorTreeNodeByPath(testFilePath_1);
    expect(node).toBeDefined();
    node = await explorer.getOpenedEditorTreeNodeByPath(testFilePath_2);
    expect(node).toBeDefined();
    await app.page.reload();
    await app.page.waitForTimeout(2000);
    node = await explorer.getOpenedEditorTreeNodeByPath(testFilePath_1);
    expect(node).toBeDefined();
    node = await explorer.getOpenedEditorTreeNodeByPath(testFilePath_2);
    expect(node).toBeDefined();
  });

  test('split file on the editor should showing on two group', async () => {
    await openedEditorView.open();
    expect(await openedEditorView.isVisible()).toBeTruthy();
    const testFilePath = 'editor3.js';
    const editor = await app.openEditor(OpenSumiTextEditor, explorer, testFilePath);
    await editor.triggerTitleMenuById('editor.splitToRight');
    await app.page.waitForTimeout(2000);
    const group1 = await explorer.getOpenedEditorTreeNodeByPath('GROUP 1');
    const group2 = await explorer.getOpenedEditorTreeNodeByPath('GROUP 2');
    expect(group1).toBeDefined();
    expect(group2).toBeDefined();
  });

  test('create file with path', async () => {
    await fileTreeView.open();
    const node = await explorer.getFileStatTreeNodeByPath('test');
    await node?.expand();
    expect(await node?.isCollapsed()).toBeFalsy();
    let menu = await node?.openContextMenu();
    expect(await menu?.isOpen()).toBeTruthy();
    let newFileMenu = await menu?.menuItemByName('New File');
    await newFileMenu?.click();
    // type `index.ts` as the file name
    let newFileName = 'index.ts';
    let input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    await app.page.waitForTimeout(200);
    const newFile = await explorer.getFileStatTreeNodeByPath(`test/${newFileName}`);
    expect(newFile).toBeDefined();
    expect(await newFile?.isFolder()).toBeFalsy();
    // new compress node by path
    menu = await node?.openContextMenu();
    newFileMenu = await menu?.menuItemByName('New File');
    await newFileMenu?.click();
    // type `a/b/c.js` as the file name
    newFileName = 'a/b/c.js';
    input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    await app.page.waitForTimeout(1000);
    // |- test
    // |----a/b
    let nodeA = await explorer.getFileStatTreeNodeByPath('test/a');
    await nodeA?.expand();
    await app.page.waitForTimeout(2000);
    expect(await nodeA?.isCollapsed()).toBeFalsy();
    const compressNode = await explorer.getFileStatTreeNodeByPath('test/a/b');
    expect(compressNode).toBeDefined();
    expect(await compressNode?.label()).toBe('a/b');
    menu = await node?.openContextMenu();
    newFileMenu = await menu?.menuItemByName('New File');
    await newFileMenu?.click();
    // type `a/d/c.js` as the file name
    newFileName = 'a/d/c.js';
    input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    await app.page.waitForTimeout(2000);
    // |- test
    // |----a
    // |------b
    // |------d
    // The `a` directory becomes collapsed again due to the compressed path being reset
    nodeA = await explorer.getFileStatTreeNodeByPath('test/a');
    await nodeA?.expand();
    const uncompressNode = await explorer.getFileStatTreeNodeByPath('test/a/b');
    expect(uncompressNode).toBeDefined();
    expect(await uncompressNode?.label()).toBe('b');
    // After delete `test/a/b` folder
    // |- test
    // |----a/d
    menu = await uncompressNode?.openContextMenu();
    const deleteMenu = await menu?.menuItemByName('Delete');
    await deleteMenu?.click();
    await app.page.waitForTimeout(200);
    const confirmed = await app.getDialogButton(isMacintosh ? 'Move to Trash' : 'Delete');
    await confirmed?.click();
    await app.page.waitForTimeout(2000);
    const afterDeleteNode = await explorer.getFileStatTreeNodeByPath('test/a/d');
    expect(afterDeleteNode).toBeDefined();
    expect(await afterDeleteNode?.label()).toBe('a/d');
    const leftNode = await explorer.getFileStatTreeNodeByPath('test/a/d/c.js');
    expect(leftNode).toBeDefined();
  });

  test('the visible state of outline panel should be restored after refreshing', async () => {
    if (!(await explorer.isVisible())) {
      await explorer.open();
    }
    await outlineView.open();
    const menu = await outlineView.openTabContextMenu();
    await menu?.clickMenuItem(outlineView.name!);
    await app.page.waitForTimeout(1000);
    // Default to be visibled
    expect(await outlineView.isVisible()).toBeFalsy();
    await app.page.reload();
    await app.page.waitForTimeout(2000);
    expect(await outlineView.isVisible()).toBeFalsy();
  });

  test('when a new file is created in the folder, the rest of the expanded folders are still expanded', async () => {
    let action = await fileTreeView.getTitleActionByName('New File');
    await action?.click();
    // type `new_folder3` as the folder name
    const newFileName_1 = 'new_folder3/index.js';
    let input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName_1, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    await app.page.waitForTimeout(200);
    let node = await explorer.getFileStatTreeNodeByPath('new_folder3');
    await node?.open();

    action = await fileTreeView.getTitleActionByName('New Folder');
    await action?.click();
    // type `new_folder4` as the folder name
    const newFileName_2 = 'new_folder4';
    input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName_2, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    await app.page.waitForTimeout(200);
    node = await explorer.getFileStatTreeNodeByPath(newFileName_2);
    await node?.open();
    await app.page.waitForTimeout(200);
    expect(await node?.isExpanded()).toBeTruthy();

    // select the `new_folder3` folder and toggle it twice
    node = await explorer.getFileStatTreeNodeByPath(newFileName_1);
    await node?.open();
    await node?.open();

    action = await fileTreeView.getTitleActionByName('New File');
    await action?.click();
    // type `new_file` as the file name
    const newFileName_3 = 'new_file';
    input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
    if (input != null) {
      await input.focus();
      await input.type(newFileName_3, { delay: 200 });
      await app.page.keyboard.press('Enter');
    }
    await app.page.waitForTimeout(200);

    node = await explorer.getFileStatTreeNodeByPath(newFileName_3);
    expect(node).toBeDefined();
    // The `new_folder3` folder should be expaned also
    node = await explorer.getFileStatTreeNodeByPath(newFileName_1);
    expect(await node?.isExpanded()).toBeTruthy();
  });
});
