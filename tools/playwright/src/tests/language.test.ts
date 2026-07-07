import path from 'path';

import { Page, expect } from '@playwright/test';

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

test.describe.configure({ mode: 'serial' });

class ExtensionDefinitionProviderLanguageApp extends OpenSumiApp {
  protected async load(workspace: OpenSumiWorkspace): Promise<void> {
    this.disposables.push(workspace);
    const now = Date.now();
    const query = new URLSearchParams({
      workspaceDir: workspace.workspace.codeUri.fsPath,
      userPreferenceDirName: workspace.userPreferenceDirName,
      aiPanelLayout: 'classic',
      extensionDevelopmentPath: path.resolve(__dirname, '../../src/tests/extensions/language-definition-provider'),
    });

    await this.loadOrReload(this.page, `/?${query.toString()}`);
    const time = Date.now() - now;
    // eslint-disable-next-line no-console
    console.log(`Loading page cost ${time} ms`);
    await this.waitForWorkbenchReady();
  }
}

async function loadLanguageWorkbench(appFactory: new (page: Page) => OpenSumiApp = OpenSumiApp) {
  workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/language')]);
  app = await OpenSumiApp.loadApp(page, workspace, appFactory);
  explorer = await app.open(OpenSumiExplorerView);
  explorer.initFileTreeView(workspace.workspace.displayName);
  await explorer.fileTreeView.open();
}

async function openSelectedDefinitionFromPeek() {
  const peek = app.page.locator('.peekview-widget').first();
  if (
    !(await peek
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false))
  ) {
    return;
  }

  await peek.locator('.monaco-list-row', { hasText: 'export class Definition' }).first().dblclick();
  await peek.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => undefined);
}

async function expectDefinitionOpenedByCmdClick() {
  const folder = await explorer.getFileStatTreeNodeByPath('language');
  await folder?.open();

  editor = await app.openEditor(OpenSumiTextEditor, explorer, 'reference.ts', false);
  await editor.activate();
  await app.page.waitForTimeout(2000);
  await editor.placeCursorInLineWithPosition(4, 20);
  let cursorHandle = await editor.getCursorElement();
  await cursorHandle?.click({ modifiers: [isMacintosh ? 'Meta' : 'Control'] });
  await openSelectedDefinitionFromPeek();
  await expect.poll(async () => await (await editor.getCurrentTab())?.textContent()).toStrictEqual(' definition.ts');
  await expect
    .poll(async () => {
      const definitionTree = await explorer.getFileStatTreeNodeByPath('definition.ts');
      return !!(await definitionTree?.isSelected());
    })
    .toBeTruthy();

  cursorHandle = await editor.getCursorElement();
  const cursorLineNumber = await editor.getCursorLineNumber(cursorHandle?.asElement());
  expect(cursorLineNumber).toBe(1);
  expect(await editor.textContentOfLineByLineNumber(cursorLineNumber!)).toBe('export class Definition {');

  await editor.close();
}

test.describe('OpenSumi built-in TypeScript language provider', () => {
  test.beforeAll(async () => {
    await loadLanguageWorkbench();
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('opens TypeScript definition results from the built-in language service with cmd + click', async () => {
    await expectDefinitionOpenedByCmdClick();
  });
});

test.describe('OpenSumi Language extension definition provider', () => {
  test.beforeAll(async () => {
    await loadLanguageWorkbench(ExtensionDefinitionProviderLanguageApp);
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('opens definition results contributed by an extension provider with cmd + click', async () => {
    await expectDefinitionOpenedByCmdClick();
  });
});
