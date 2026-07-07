import path from 'path';

import { expect } from '@playwright/test';

import { isLinux, isWindows } from '@opensumi/ide-utils';

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
    await app.reload();
    await expect.poll(async () => !!(await explorer.getOpenedEditorTreeNodeByPath(testFilePath_1))).toBeTruthy();
    await expect.poll(async () => !!(await explorer.getOpenedEditorTreeNodeByPath(testFilePath_2))).toBeTruthy();
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
    const confirmed = await app.getDialogButton(!isLinux ? 'Move to Trash' : 'Delete');
    await confirmed?.click();
    await app.page.waitForTimeout(2000);
    await expect
      .poll(async () => {
        const afterDeleteNode = await explorer.getFileStatTreeNodeByPath('test/a/d');
        return afterDeleteNode ? await afterDeleteNode.label() : undefined;
      })
      .toBe('a/d');
    const afterDeleteNode = await explorer.getFileStatTreeNodeByPath('test/a/d');
    expect(afterDeleteNode).toBeDefined();
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
    await app.page.waitForSelector(outlineView.tabSelector, { state: 'detached' });
    await app.page.waitForTimeout(500);
    // Default to be visibled
    expect(await outlineView.isVisible()).toBeFalsy();
    await app.reload();
    await expect.poll(async () => await outlineView.isVisible()).toBeFalsy();
  });

  test('when a new file is created through explorer actions, the rest of the expanded folders are still expanded', async () => {
    await app.reload();
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
    await fileTreeView.open();

    const waitForFileStatTreeNode = async (path: string) => {
      await expect
        .poll(async () => !!(await explorer.getFileStatTreeNodeByPath(path)), { timeout: 10000 })
        .toBeTruthy();
      return explorer.getFileStatTreeNodeByPath(path);
    };

    const createFromExplorerToolbar = async (
      actionName: 'New File' | 'New Folder',
      name: string,
      visiblePath = name,
    ) => {
      const seedNode = await waitForFileStatTreeNode('editor.js');
      await seedNode?.open();
      const action = await fileTreeView.getTitleActionByName(actionName);
      await action?.click();
      const input = await (await fileTreeView.getViewElement())?.waitForSelector('.kt-input-box');
      if (!input) {
        throw new Error(`Cannot find explorer input after clicking ${actionName}`);
      }
      await input.focus();
      await input.type(name, { delay: 100 });
      await app.page.keyboard.press('Enter');
      await waitForFileStatTreeNode(visiblePath);
    };

    const folderName = 'ui_keep_folder3';
    await createFromExplorerToolbar('New File', `${folderName}/index.js`, folderName);
    let node = await waitForFileStatTreeNode(folderName);
    await node?.expand();

    await createFromExplorerToolbar('New Folder', 'ui_keep_folder4');
    node = await waitForFileStatTreeNode('ui_keep_folder4');
    await node?.expand();
    expect(await node?.isExpanded()).toBeTruthy();

    node = await waitForFileStatTreeNode(folderName);
    await node?.collapse();
    await node?.expand();

    await createFromExplorerToolbar('New File', 'ui_keep_file');
    node = await waitForFileStatTreeNode('ui_keep_file');
    expect(node).toBeDefined();

    await expect
      .poll(async () => {
        const newFolder = await explorer.getFileStatTreeNodeByPath(folderName);
        return newFolder ? await newFolder.isExpanded() : false;
      })
      .toBeTruthy();
  });

  test('when an external filesystem change creates a new file, the rest of the expanded folders are still expanded', async () => {
    await app.reload();
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
    await fileTreeView.open();

    const waitForFileStatTreeNode = async (path: string) => {
      await expect
        .poll(async () => !!(await explorer.getFileStatTreeNodeByPath(path)), { timeout: 3000 })
        .toBeTruthy()
        .catch(async () => {
          const refresh = await fileTreeView.getTitleActionByName('Refresh');
          await refresh?.click();
          await expect
            .poll(async () => !!(await explorer.getFileStatTreeNodeByPath(path)), { timeout: 10000 })
            .toBeTruthy();
        });
      return explorer.getFileStatTreeNodeByPath(path);
    };

    const ensureFileTreeRootExpanded = async () => {
      await explorer.open();
      await fileTreeView.open();
      await fileTreeView.waitForVisible();
      const viewElement = await fileTreeView.getViewElement();
      const rootNode = await viewElement?.waitForSelector('[class*="file_tree_node__"]');
      if (await rootNode?.$('[class*="mod_collapsed__"]')) {
        await (await rootNode?.waitForSelector('[class*="expansion_toggle__"]'))?.click();
        await expect.poll(async () => !(await rootNode?.$('[class*="mod_collapsed__"]'))).toBeTruthy();
      }
    };

    const terminal = await app.open(OpenSumiTerminalView);
    await terminal.sendText(`cd ${workspace.workspace.codeUri.fsPath}`);

    const runNodeFsScript = async (script: string) => {
      await ensureFileTreeRootExpanded();
      await terminal.sendText(`node -e "${script}"`);
    };

    const createWorkspaceFile = async (relativePath: string, visiblePath = relativePath) => {
      await runNodeFsScript(
        `const fs=require('fs');const path=require('path');fs.mkdirSync(path.dirname('${relativePath}'),{recursive:true});fs.writeFileSync('${relativePath}','');`,
      );
      await waitForFileStatTreeNode(visiblePath);
    };

    const createWorkspaceDir = async (relativePath: string) => {
      await runNodeFsScript(`require('fs').mkdirSync('${relativePath}',{recursive:true});`);
      await waitForFileStatTreeNode(relativePath);
    };

    // type `new_folder3` as the folder name
    const newFileName_1 = 'new_folder3/index.js';
    await createWorkspaceFile(newFileName_1, 'new_folder3');
    let node = await waitForFileStatTreeNode('new_folder3');
    await node?.open();

    // type `new_folder4` as the folder name
    const newFileName_2 = 'new_folder4';
    await createWorkspaceDir(newFileName_2);
    node = await waitForFileStatTreeNode(newFileName_2);
    await node?.open();
    await app.page.waitForTimeout(200);
    expect(await node?.isExpanded()).toBeTruthy();

    // select the `new_folder3` folder and toggle it twice
    node = await waitForFileStatTreeNode('new_folder3');
    await node?.open();
    await node?.open();

    // type `new_file` as the file name
    const newFileName_3 = 'new_file';
    await createWorkspaceFile(newFileName_3);

    node = await waitForFileStatTreeNode(newFileName_3);
    expect(node).toBeDefined();
    // The `new_folder3` folder should be expaned also
    await expect
      .poll(async () => {
        const newFolder = await explorer.getFileStatTreeNodeByPath('new_folder3');
        return newFolder ? await newFolder.isExpanded() : false;
      })
      .toBeTruthy();
  });
});
