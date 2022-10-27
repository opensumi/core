import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiComponentEditor } from '../component-editor';
import { OPENSUMI_VIEW_CONTAINERS } from '../constans';
import { OpenSumiContextMenu } from '../context-menu';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiTextEditor } from '../text-editor';
import { keypressWithCmdCtrl } from '../utils';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;
let explorer: OpenSumiExplorerView;
let workspace: OpenSumiWorkspace;

test.describe('OpenSumi Keyboard Shortcuts', () => {
  test.beforeAll(async () => {
    workspace = new OpenSumiWorkspace([path.resolve('./src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
    explorer = await app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(workspace.workspace.displayName);
  });

  test.afterAll(() => {
    app.dispose();
  });

  const openKeymapsView = async () => {
    const leftTabbar = await app.page.waitForSelector(`#${OPENSUMI_VIEW_CONTAINERS.LEFT_TABBAR}`);
    const settingsButton = await leftTabbar.$('[class*="titleActions___"] span');
    await settingsButton?.click();
    const menu = new OpenSumiContextMenu(app);
    await menu.clickMenuItem('Keyboard Shortcut');
  };

  test('open Keyboard Settings by keybinding', async () => {
    await explorer.fileTreeView.focus();
    await app.page.keyboard.press(keypressWithCmdCtrl('KeyK'), { delay: 200 });
    await app.page.keyboard.press(keypressWithCmdCtrl('KeyS'), { delay: 200 });
    const editor = await app.openComponentEditor(
      OpenSumiComponentEditor,
      'keymaps:/',
      'Keyboard Shortcuts',
      "[class*='keybinding_container___']",
    );
    expect(await editor.isVisible()).toBeTruthy();
    await editor.close();
    await app.page.waitForTimeout(1000);
    expect(await editor.isVisible()).toBeFalsy();
  });

  test('open Keyboard Settings by settings button', async () => {
    await openKeymapsView();
    const editor = await app.openComponentEditor(
      OpenSumiComponentEditor,
      'keymaps:/',
      'Keyboard Shortcuts',
      "[class*='keybinding_container___']",
    );
    expect(await editor.isVisible()).toBeTruthy();
    await editor.close();
  });

  test("change 'Save Current File' keybinding to 'CMD+SHIFT+S'", async () => {
    await openKeymapsView();
    const editor = await app.openComponentEditor(
      OpenSumiComponentEditor,
      'keymaps:/',
      'Keyboard Shortcuts',
      "[class*='keybinding_container___']",
    );
    expect(await editor.isVisible()).toBeTruthy();
    const searchArea = await (await editor.getContainer())?.$('[class*="search_input___"]');
    const keyboardButton = await searchArea?.$('[class*="search_inline_action___"] span');
    const searchInput = await searchArea?.$('.kt-input-box input');
    await keyboardButton?.click();
    await searchInput?.focus();
    // type 'CMD+S' to filter 'Save Current File' command
    await app.page.keyboard.press(keypressWithCmdCtrl('KeyS'), { delay: 200 });

    const items = (await (await editor.getContainer())?.$$('[class*="keybinding_list_item__"]')) || [];
    let saveFileItem;
    for (const item of items) {
      const command_name = await (await item.$('[class*="command_name___"]'))?.textContent();
      if (command_name === 'Save Current File') {
        saveFileItem = item;
        break;
      }
    }
    expect(saveFileItem).toBeDefined();
    await saveFileItem?.hover();
    const edit = await saveFileItem.$('[title="Edit"]');
    await edit?.click();
    await app.page.keyboard.press(keypressWithCmdCtrl('Shift+KeyS'), { delay: 200 });
    await app.page.keyboard.press('Enter');
    // varified file save keybinding
    const textEditor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js');
    await textEditor.addTextToNewLineAfterLineByLineNumber(
      1,
      `const a = 'a';
console.log(a);`,
    );
    let isDirty = await textEditor.isDirty();
    expect(isDirty).toBeTruthy();
    await app.page.keyboard.press(keypressWithCmdCtrl('KeyS'), { delay: 200 });
    await app.page.waitForTimeout(1000);
    isDirty = await textEditor.isDirty();
    expect(isDirty).toBeTruthy();
    await app.page.keyboard.press(keypressWithCmdCtrl('Shift+KeyS'), { delay: 200 });
    await app.page.waitForTimeout(1000);
    isDirty = await textEditor.isDirty();
    expect(isDirty).toBeFalsy();
  });
});
