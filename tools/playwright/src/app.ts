import { ElementHandle, Page } from '@playwright/test';

import { Disposable } from '@opensumi/ide-utils';

import { IComponentEditorInfo } from './component-editor';
import { OpenSumiEditor } from './editor';
import { OpenSumiExplorerView } from './explorer-view';
import { OpenSumiMenubar } from './menubar';
import { OpenSumiPanel } from './panel';
import { OpenSumiCommandPalette } from './quick-command-palette';
import { OpenSumiQuickOpenPalette } from './quick-open-palette';
import { OpenSumiTreeNode } from './tree-node';
import { OpenSumiWorkspace } from './workspace';

export interface AppData {
  loadingSelector: string;
  mainSelector: string;
}

export const DefaultAppData: AppData = {
  loadingSelector: '.loading_indicator',
  mainSelector: '#main',
};

export class OpenSumiApp extends Disposable {
  private _loaded = false;
  private _quickCommandPalette: OpenSumiCommandPalette;
  private _quickOpenPalette: OpenSumiQuickOpenPalette;
  private _menubar: OpenSumiMenubar;

  static async load(page: Page, workspace: OpenSumiWorkspace): Promise<OpenSumiApp> {
    return this.loadApp(page, workspace, OpenSumiApp);
  }

  static async loadApp<T extends OpenSumiApp>(
    page: Page,
    workspace: OpenSumiWorkspace,
    appFactory: new (page: Page) => T,
  ): Promise<T> {
    await workspace.initWorksapce();
    const app = new appFactory(page);
    await app.load(workspace);
    return app;
  }

  public constructor(public page: Page, protected appData = DefaultAppData) {
    super();
    this._quickCommandPalette = new OpenSumiCommandPalette(this);
    this._quickOpenPalette = new OpenSumiQuickOpenPalette(this);
    this._menubar = new OpenSumiMenubar(this);
  }

  get quickCommandPalette() {
    return this._quickCommandPalette;
  }

  get quickOpenPalette() {
    return this._quickOpenPalette;
  }

  get menubar() {
    return this._menubar;
  }

  protected async load(workspace: OpenSumiWorkspace): Promise<void> {
    this.disposables.push(workspace);
    const now = Date.now();
    const query = new URLSearchParams({
      workspaceDir: workspace.workspace.codeUri.fsPath,
      userPreferenceDirName: workspace.userPreferenceDirName,
      aiPanelLayout: 'classic',
    });
    await this.loadOrReload(this.page, `/?${query.toString()}`);
    const time = Date.now() - now;
    // eslint-disable-next-line no-console
    console.log(`Loading page cost ${time} ms`);
    await this.waitForWorkbenchReady();
  }

  async reload(): Promise<void> {
    await this.loadOrReload(this.page);
    await this.waitForWorkbenchReady();
  }

  async executeCommand<T = unknown>(commandId: string, ...args: unknown[]): Promise<T> {
    await this.page.waitForFunction(() => !!(window as any).__OPENSUMI_E2E__?.executeCommand, null, {
      timeout: 10000,
    });
    return this.page.evaluate(
      ({ commandId, args }) => (window as any).__OPENSUMI_E2E__.executeCommand(commandId, ...args),
      { commandId, args },
    );
  }

  protected async waitForWorkbenchReady(): Promise<void> {
    await this.page.waitForSelector(this.appData.loadingSelector, { state: 'detached' });
    await this.page.waitForSelector(this.appData.mainSelector);
    await this.ensureClassicLayout();
    await this.waitForInitialized();
    await this.recoverCrashedExtensionHost();
  }

  protected async loadOrReload(page: Page, url = '/') {
    if (!this._loaded) {
      const wasLoadedAlready = await page.isVisible(this.appData.mainSelector);
      await page.goto(url);
      if (wasLoadedAlready) {
        await page.reload();
      }
      this._loaded = true;
    } else {
      await page.reload();
    }
  }

  async isMainLayoutVisible(): Promise<boolean> {
    const contentPanel = await this.page.$('#main');
    return !!contentPanel && contentPanel.isVisible();
  }

  async open<T extends OpenSumiPanel>(PanelConstruction: new (app: OpenSumiApp) => T) {
    await this.recoverCrashedExtensionHost();
    const panel = new PanelConstruction(this);
    if (await panel.isVisible()) {
      return panel;
    }
    await panel.open();
    return panel;
  }

  async openEditor<T extends OpenSumiEditor>(
    EditorConstruction: new (app: OpenSumiApp, element?: OpenSumiTreeNode) => T,
    explorer: OpenSumiExplorerView,
    filePath: string,
    preview = true,
  ) {
    await this.recoverCrashedExtensionHost();
    await explorer.open();
    const node = await explorer.getFileStatTreeNodeByPath(filePath);
    if (!node || (await node?.isFolder())) {
      throw Error(`File ${filePath} could not be opened on the editor`);
    }
    const editor = new EditorConstruction(this, node);
    await editor.open(preview);
    return editor;
  }

  // use for component editors
  async openComponentEditor<T extends OpenSumiEditor>(
    EditorConstruction: new (app: OpenSumiApp, info: IComponentEditorInfo) => T,
    path: string,
    name: string,
    containerSelector: string,
  ) {
    const editor = new EditorConstruction(this, { path, name, containerSelector });
    await editor.open();
    return editor;
  }

  async getDialogButton(value: string): Promise<ElementHandle<SVGElement | HTMLElement> | void> {
    const buttonWrapper = await this.page.$('.kt-dialog-buttonWrap');
    const buttons = await buttonWrapper?.$$('.kt-button');
    const expected = value.trim().toLocaleLowerCase();
    if (buttons) {
      for (const button of buttons) {
        const text = await button.textContent();
        if (text?.trim().toLocaleLowerCase() === expected) {
          return button;
        }
      }
    }
  }

  async waitForInitialized(): Promise<void> {
    // custom app initialize process.
    // empty by default
  }

  protected async ensureClassicLayout(): Promise<void> {
    const openClassicLayout = this.page.getByText('Open IDE layout', { exact: true });
    if (await openClassicLayout.isVisible({ timeout: 1000 }).catch(() => false)) {
      await openClassicLayout.click();
      await this.page.waitForSelector('#opensumi-left-tabbar li#explorer', { state: 'visible', timeout: 30000 });
    }

    await this.hideAIChatView();
  }

  protected async hideAIChatView(): Promise<void> {
    const aiChatSlot = this.page.locator('.AI-Chat-slot').first();
    if (!(await aiChatSlot.isVisible({ timeout: 1000 }).catch(() => false))) {
      return;
    }

    const closeButtons = this.page.locator(
      '#ai-chat-header-close [role="button"], #ai_right_panel_header_close [role="button"]',
    );
    for (let index = 0; index < (await closeButtons.count()); index++) {
      const closeButton = closeButtons.nth(index);
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
        await aiChatSlot.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
        return;
      }
    }
  }

  async recoverCrashedExtensionHost(): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const crashMessage = this.page.getByText('Extension Host Process is crashed');
      if (await crashMessage.isVisible({ timeout: 500 }).catch(() => false)) {
        const restartButton = this.page.getByRole('button', { name: 'Yes' }).last();
        if (await restartButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await restartButton.click();
          await crashMessage.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
        }
      }

      const restartingMessage = this.page.getByText('Extension Host Process is restarting');
      if (!(await restartingMessage.isVisible({ timeout: 500 }).catch(() => false))) {
        return;
      }

      const refreshButton = this.page.getByRole('button', { name: 'Refresh' }).last();
      if (!(await refreshButton.isVisible({ timeout: 1000 }).catch(() => false))) {
        await restartingMessage.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
        return;
      }

      await refreshButton.click();
      await this.page
        .waitForSelector(this.appData.loadingSelector, { state: 'detached', timeout: 60000 })
        .catch(() => undefined);
      await this.page.waitForSelector(this.appData.mainSelector, { timeout: 60000 }).catch(() => undefined);
      await this.waitForInitialized();
    }
  }
}
