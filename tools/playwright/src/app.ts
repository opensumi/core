import { Page } from '@playwright/test';

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
    await this.loadOrReload(this.page, `/#${workspace.workspace.codeUri.fsPath}`);
    await this.page.waitForSelector(this.appData.loadingSelector, { state: 'detached' });
    const time = Date.now() - now;
    // eslint-disable-next-line no-console
    console.log(`Loading page cost ${time} ms`);
    await this.page.waitForSelector(this.appData.mainSelector);
    await this.waitForInitialized();
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

  async waitForInitialized(): Promise<void> {
    // custom app initialize process.
    // empty by default
  }
}
