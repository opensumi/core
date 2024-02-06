import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiFileTreeView } from '../filetree-view';
import { OpenSumiOutputView } from '../output-view';
import { keypressWithCmdCtrl } from '../utils/key';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let fileTreeView: OpenSumiFileTreeView;
let workspace: OpenSumiWorkspace;
let output: OpenSumiOutputView;

test.describe('OpenSumi Output View', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/language')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
    fileTreeView = explorer.fileTreeView;
    output = await app.open(OpenSumiOutputView);
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('should show file explorer and output panel', async () => {
    expect(await output.isVisible()).toBeTruthy();
    await fileTreeView.open();
    expect(await fileTreeView.isVisible()).toBeTruthy();
  });

  test('get `TypeScript` channel output content', async () => {
    const node = await explorer.getFileStatTreeNodeByPath('reference.ts');
    await node?.open();
    await page.waitForTimeout(1000);

    await output.setChannel('TypeScript');
    const content = await output.getCurrentContent();
    expect(content?.includes('tsserver')).toBeTruthy();
  });

  test('can search text from output', async () => {
    // Focus Output content
    await output.focus();
    const box = await output.view?.boundingBox();
    if (box) {
      await output.app.page.mouse.click(box.x + box?.width / 2, box.y + box?.height / 2);
    }
    await app.page.keyboard.press(keypressWithCmdCtrl('KeyF'));
    const textArea = await output.view?.$('.monaco-inputbox textarea');
    await textArea?.focus();
    await textArea?.type('tsserver', { delay: 200 });

    let selected = await output.view?.$('.selected-text');
    expect(selected).toBeDefined();

    await textArea?.focus();
    await app.page.keyboard.press('Escape');
    if (box) {
      await output.app.page.mouse.click(box.x + box?.width / 2, box.y + box?.height / 2);
    }
    selected = await output.view?.$('.selected-text');
    expect(selected).toBeNull();
  });

  test('clean output content', async () => {
    const node = await explorer.getFileStatTreeNodeByPath('definition.ts');
    await node?.open();
    await page.waitForTimeout(1000);

    await output.setChannel('TypeScript');
    let content = await output.getCurrentContent();
    expect(content?.includes('tsserver')).toBeTruthy();

    await output.clean();
    content = await output.getCurrentContent();
    expect(content?.includes('tsserver')).toBeFalsy();
  });
});
