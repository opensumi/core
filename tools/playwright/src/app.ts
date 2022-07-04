import { Page } from '@playwright/test';

export interface AppData {
  loadingSelector: string;
  mainSelector: string;
}

export const DefaultAppData: AppData = {
  loadingSelector: '.loading_indicator',
  mainSelector: '#main',
};

export class App {
  private _loaded = false;

  static async load(page: Page): Promise<App> {
    return this.loadApp(page, App);
  }

  static async loadApp<T extends App>(page: Page, appFactory: new (page: Page) => T): Promise<T> {
    const app = new appFactory(page);
    await app.load();
    return app;
  }

  public constructor(public page: Page, protected appData = DefaultAppData) {}

  protected async load(): Promise<void> {
    const now = Date.now();
    await this.loadOrReload(this.page);
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

  /** Specific apps may add additional conditions to wait for. */
  async waitForInitialized(): Promise<void> {
    // empty by default
  }
}
