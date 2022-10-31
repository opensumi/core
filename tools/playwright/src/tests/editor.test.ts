import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OPENSUMI_VIEW_CONTAINERS } from '../constans';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiTextEditor } from '../text-editor';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let editor: OpenSumiTextEditor;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi Editor', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    await explorer.fileTreeView.open();
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('open editor.js on the editor with preview', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js');
    const isPreview = await editor.isPreview();
    expect(isPreview).toBeTruthy();
    await editor.close();
  });

  test('open editor.js on the editor without preview', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js', false);
    const isPreview = await editor.isPreview();
    expect(isPreview).toBeFalsy();
    await editor.close();
  });

  test('editor dirty status should be update immediately after typing and saving', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js');
    await editor.addTextToNewLineAfterLineByLineNumber(
      1,
      `const a = 'a';
console.log(a);`,
    );
    let isDirty = await editor.isDirty();
    expect(isDirty).toBeTruthy();
    await editor.save();
    await app.page.waitForTimeout(2000);
    isDirty = await editor.isDirty();
    expect(isDirty).toBeFalsy();
    await editor.close();
  });

  test('File tree automatic location', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js', false);
    const editor2 = await app.openEditor(OpenSumiTextEditor, explorer, 'editor2.js', false);
    await app.page.waitForTimeout(1000);
    const firstFileTab = await editor.getTab();
    await firstFileTab?.click();
    await app.page.waitForTimeout(1000);
    const node = await explorer.getFileStatTreeNodeByPath('editor.js');
    expect(await node?.isSelected()).toBeTruthy();
    const node2 = await explorer.getFileStatTreeNodeByPath('editor2.js');
    expect(await node2?.isSelected()).toBeFalsy();
    await editor.close();
    await editor2.close();
  });

  test('Close All Editors should be worked', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js', false);
    await app.openEditor(OpenSumiTextEditor, explorer, 'editor2.js', false);
    await app.page.waitForTimeout(1000);
    expect(await editor.isTabVisible()).toBeTruthy();
    const contextMenu = await editor.openTabContextMenu();
    expect(await contextMenu?.isOpen()).toBeTruthy();
    const closeAll = await contextMenu?.menuItemByName('Close All');
    await closeAll?.click();
    await app.page.waitForTimeout(1000);
    expect(await editor.isTabVisible()).toBeFalsy();
  });

  test('copy path from file explorer to the editor content', async () => {
    const node = await explorer.getFileStatTreeNodeByPath('editor3.js');
    let fileMenu = await node?.openContextMenu();
    expect(await fileMenu?.isOpen()).toBeTruthy();
    const copyPath = await fileMenu?.menuItemByName('Copy Path');
    await app.page.waitForTimeout(400);
    await copyPath?.click();
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor3.js');
    await editor.addTextToNewLineAfterLineByLineNumber(1, 'File Path: ');
    // cause of https://github.com/microsoft/playwright/issues/8114
    // we can just using keypress to fake the paste feature
    let editorMenu = await editor.openLineContextMenuByLineNumber(2);
    expect(await editorMenu?.isOpen()).toBeTruthy();
    let paste = await editorMenu?.menuItemByName('Paste');
    await paste?.click();
    await app.page.waitForTimeout(200);
    expect(await editor.numberOfLines()).toBe(2);
    expect(
      await editor.textContentOfLineContainingText(
        `File Path: ${workspace.workspace.resolve('editor3.js').codeUri.fsPath.toString()}`,
      ),
    ).toBeTruthy();
    fileMenu = await node?.openContextMenu();
    const copyRelativePath = await fileMenu?.menuItemByName('Copy Relative Path');
    await copyRelativePath?.click();
    await app.page.waitForTimeout(200);
    await editor.addTextToNewLineAfterLineByLineNumber(2, 'File Relative Path: ');
    editorMenu = await editor.openLineContextMenuByLineNumber(3);
    expect(await editorMenu?.isOpen()).toBeTruthy();
    paste = await editorMenu?.menuItemByName('Paste');
    await paste?.click();
    await app.page.waitForTimeout(200);
    expect(await editor.numberOfLines()).toBe(3);
    expect(await editor.textContentOfLineContainingText('File Relative Path: editor3.js')).toBeTruthy();
  });

  test('Go to Symbol... should be worked', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor2.js');
    // waiting for extHost process done.
    await app.page.waitForTimeout(1000);
    const editorMenu = await editor.openLineContextMenuByLineNumber(1);
    expect(await editorMenu?.isOpen()).toBeTruthy();
    const goto = await editorMenu?.menuItemByName('Go to Symbol...');
    await goto?.click();
    await app.page.waitForTimeout(1000);
    const input = await app.page.waitForSelector(`#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK_INPUT}`);
    await input.focus();
    await app.page.keyboard.press(' ');
    await app.page.keyboard.press('ArrowDown');
    await app.page.keyboard.press('ArrowDown');
    await app.page.keyboard.press('Enter');
    await app.page.keyboard.press('Delete');
    expect(await editor.textContentOfLineContainingText('Person.prototype.getAge = ;')).toBeTruthy();
  });
});
