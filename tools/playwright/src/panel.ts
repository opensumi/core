import { ElementHandle, Locator } from '@playwright/test';

import { OpenSumiApp } from './app';
import { OpenSumiViewBase } from './view-base';

export abstract class OpenSumiPanel extends OpenSumiViewBase {
  public view: ElementHandle<HTMLElement | SVGElement> | null;
  private whenReady: Promise<void>;

  constructor(app: OpenSumiApp, private viewId: string) {
    super(app);
    this.whenReady = this.init();
  }

  get viewSelector() {
    return `[data-viewlet-id="${this.viewId.toLocaleLowerCase()}"]`;
  }

  async init() {
    this.view = await this.page.$(this.viewSelector);
  }

  async isVisible() {
    await this.whenReady;
    return this.view?.isVisible();
  }

  async open() {
    if (!this.viewId) {
      return;
    }
    const viewletId = this.viewId.toLocaleLowerCase();
    const tab = this.page
      .locator(`#opensumi-left-tabbar li#${viewletId}, #opensumi-bottom-tabbar li#${viewletId}`)
      .first();
    if ((await tab.count()) > 0 && (await tab.isVisible())) {
      await tab.click();
      try {
        await this.waitForVisible(10000);
        this.view = await this.page.$(this.viewSelector);
        return this;
      } catch {
        await this.expandCollapsedBottomPanel(tab);
      }
    }

    await this.app.quickCommandPalette.type('Open View');
    await this.app.quickCommandPalette.trigger('View: Open View ...');
    await this.app.quickOpenPalette.trigger(this.viewId);
    await this.expandCollapsedBottomPanel(tab);
    await this.waitForVisible();
    this.view = await this.page.$(this.viewSelector);
    return this;
  }

  async focus() {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    await this.view?.focus();
  }

  async waitForVisible(timeout?: number) {
    await this.page.waitForSelector(this.viewSelector, { state: 'visible', timeout });
  }

  private async expandCollapsedBottomPanel(tab: Locator): Promise<void> {
    if (!(await this.isBottomTab(tab))) {
      return;
    }
    await this.app.quickCommandPalette.type('Maximize Tab Panel');
    await this.app.quickCommandPalette.trigger('Maximize Tab Panel');
    await this.waitForVisible(10000).catch(() => undefined);
    await this.app.quickCommandPalette.type('Retract Tab Panel');
    await this.app.quickCommandPalette.trigger('Retract Tab Panel');
    await tab.click();
    await this.waitForVisible(10000).catch(() => undefined);
  }

  private async isBottomTab(tab: Locator): Promise<boolean> {
    return (
      (await tab.count()) > 0 &&
      (await tab.evaluate((node) => node.closest('#opensumi-bottom-tabbar') !== null).catch(() => false))
    );
  }
}
