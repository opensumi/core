import path from 'path';

import { expect } from '@playwright/test';

import { isMacintosh } from '@opensumi/ide-utils';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiTextEditor } from '../text-editor';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let editor: OpenSumiTextEditor;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi Language', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default/language')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    await explorer.fileTreeView.open();
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('Go to Defination by cmd + click', async () => {
    editor = await app.openEditor(OpenSumiTextEditor, explorer, 'reference.ts', false);

    await editor.placeCursorInLineWithPosition(4, 20);
    let cursorHandle = await editor.getCursorElement();

    await cursorHandle?.click({ modifiers: [isMacintosh ? 'Meta' : 'Control'] });
    await app.page.waitForTimeout(1000);

    const definitionTree = await explorer.getFileStatTreeNodeByPath('definition.ts');
    expect(await definitionTree?.isSelected()).toBeTruthy();
    const currentTab = await editor.getCurrentTab();
    expect(await currentTab?.textContent()).toStrictEqual(' definition.ts');

    cursorHandle = await editor.getCursorElement();
    const cursorLineNumber = await editor.getCursorLineNumber(cursorHandle?.asElement());
    expect(cursorLineNumber).toBe(1);
    expect(await editor.textContentOfLineByLineNumber(cursorLineNumber!)).toBe('export class Definition {');

    await editor.close();
  });
});
