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
  });

  test('open editor.js on the editor without preview', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js', false);
    const isPreview = await editor.isPreview();
    expect(isPreview).toBeFalsy();
  });

  test('editor dirty status should be update immediately after typing and saving', async () => {
    await editor.addTextToNewLineAfterLineByLineNumber(
      1,
      `const a = 'a';
console.log(a);`,
    );
    let isDirty = await editor.isDirty();
    expect(isDirty).toBeTruthy();
    await editor.save();
    await app.page.waitForTimeout(200);
    isDirty = await editor.isDirty();
    expect(isDirty).toBeFalsy();
  });

  test('copy path from file explorer to the editor content', async () => {
    const node = await explorer.getFileStatTreeNodeByPath('editor.js');
    let fileMenu = await node?.openContextMenu();
    expect(await fileMenu?.isOpen()).toBeTruthy();
    const copyPath = await fileMenu?.menuItemByName('Copy Path');
    await copyPath?.click();
    await editor.addTextToNewLineAfterLineByLineNumber(3, 'File Path: ');
    // cause of https://github.com/microsoft/playwright/issues/8114
    // we can just using keypress to fake the paste feature
    let editorMenu = await editor.openLineContextMenuByLineNumber(4);
    expect(await editorMenu?.isOpen()).toBeTruthy();
    let paste = await editorMenu?.menuItemByName('Paste');
    await paste?.click();
    await app.page.waitForTimeout(200);
    expect(await editor.numberOfLines()).toBe(4);
    expect(
      await editor.textContentOfLineContainingText(
        `File Path: ${workspace.workspace.resolve('editor.js').codeUri.fsPath.toString()}`,
      ),
    ).toBeTruthy();
    fileMenu = await node?.openContextMenu();
    const copyRelativePath = await fileMenu?.menuItemByName('Copy Relative Path');
    await copyRelativePath?.click();
    await app.page.waitForTimeout(200);
    await editor.addTextToNewLineAfterLineByLineNumber(4, 'File Relative Path: ');
    editorMenu = await editor.openLineContextMenuByLineNumber(5);
    expect(await editorMenu?.isOpen()).toBeTruthy();
    paste = await editorMenu?.menuItemByName('Paste');
    await paste?.click();
    await app.page.waitForTimeout(200);
    expect(await editor.numberOfLines()).toBe(5);
    expect(await editor.textContentOfLineContainingText('File Relative Path: editor.js')).toBeTruthy();
  });

  test('Go to Symbol... should be worked', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor2.js');
    const editorMenu = await editor.openLineContextMenuByLineNumber(1);
    expect(await editorMenu?.isOpen()).toBeTruthy();
    const goto = await editorMenu?.menuItemByName('Go to Symbol...');
    await goto?.click();
    await app.page.waitForTimeout(200);
    const input = await app.page.waitForSelector(`#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK_INPUT}`);
    await input.focus();
    await app.page.keyboard.press('ArrowDown');
    await app.page.keyboard.press('ArrowDown');
    await app.page.keyboard.press('Enter');
    await app.page.keyboard.press('Delete');
    expect(await editor.textContentOfLineContainingText('Person.prototype.getAge = ;')).toBeTruthy();
  });
});
