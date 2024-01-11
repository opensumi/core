import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../../app';
import { OpenSumiExplorerView } from '../../explorer-view';
import { OpenSumiTextEditor } from '../../text-editor';
import { OpenSumiWorkspace } from '../../workspace';
import test, { page } from '../hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let editor: OpenSumiTextEditor;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi Editor Undo Redo', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    await explorer.fileTreeView.open();
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('simple editor undo/redo should work', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor-undo-redo.text');
    const existingLine = await editor.lineByLineNumber(1);
    await editor.placeCursorInLine(existingLine);
    await editor.typeText('a');
    await editor.saveByKeyboard();
    await editor.typeText('b');
    await editor.saveByKeyboard();
    await editor.typeText('c');
    await editor.saveByKeyboard();
    await expectLineHasText('abc');
    await editor.undoByKeyboard();
    await expectLineHasText('ab');
    await editor.undoByKeyboard();
    await expectLineHasText('a');
    await editor.redoByKeyboard();
    await expectLineHasText('ab');
    await editor.redoByKeyboard();
    await expectLineHasText('abc');

    async function expectLineHasText(text: string) {
      const line = await editor.lineByLineNumber(1);
      expect(await line?.innerText()).toEqual(text);
      await editor.placeCursorInLine(line);
    }
  });
});
