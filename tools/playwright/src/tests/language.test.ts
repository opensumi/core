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
let definitionEditor: OpenSumiTextEditor;
let referenceEditor: OpenSumiTextEditor;
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

  test('go to defination by cmd + click', async () => {
    referenceEditor = await app.openEditor(OpenSumiTextEditor, explorer, 'reference.ts', false);

    const eleHandle = await referenceEditor.placeCursorInLineWithPosition(4, 20);
    const cursorHandle = await referenceEditor.getCursorElement();
    await cursorHandle?.click({ modifiers: [isMacintosh ? 'Meta' : 'Control'] });

    await app.page.waitForTimeout(100000);
    expect(eleHandle).toBe('');
    await referenceEditor.close();
  });
});
