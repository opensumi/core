import { ElementHandle } from '@playwright/test';

import { OpenSumiApp } from './app';
import { isElementVisible, containsClass } from './utils';
import { OpenSumiViewBase } from './view-base';

export interface OpenSumiViewInfo {
  tabSelector: string;
  viewSelector: string;
  name?: string;
}

export class OpenSumiView extends OpenSumiViewBase {
  constructor(app: OpenSumiApp, private readonly data: OpenSumiViewInfo) {
    super(app);
  }

  get tabSelector() {
    return this.data.tabSelector;
  }

  get viewSelector() {
    return this.data.viewSelector;
  }

  get name() {
    return this.data.name;
  }

  getViewElement(): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    return this.page.$(this.viewSelector);
  }

  getTabElement(): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    return this.page.$(this.tabSelector);
  }

  async open(): Promise<OpenSumiView | undefined> {
    if (!this.name) {
      return;
    }
    await this.app.quickOpenPalette.type('view ');
    await this.app.quickOpenPalette.trigger(this.name);
    await this.waitForVisible();
    return this;
  }

  async focus(): Promise<void> {
    await this.activate();
    const view = await this.getViewElement();
    await view?.click();
  }

  async activate(): Promise<void> {
    await this.page.waitForSelector(this.tabSelector, { state: 'visible' });
    if (!(await this.isActive())) {
      const tab = await this.getTabElement();
      await tab?.click();
    }
    return this.waitForVisible();
  }

  async waitForVisible(): Promise<void> {
    await this.page.waitForSelector(this.viewSelector, { state: 'visible' });
  }

  async isTabVisible(): Promise<boolean> {
    return isElementVisible(this.getTabElement());
  }

  async isDisplayed(): Promise<boolean> {
    return isElementVisible(this.getViewElement());
  }

  async isActive(): Promise<boolean> {
    return (await this.isTabVisible()) && containsClass(this.getTabElement(), 'p-mod-current');
  }

  async isClosable(): Promise<boolean> {
    return (await this.isTabVisible()) && containsClass(this.getTabElement(), 'p-mod-closable');
  }

  async isVisible() {
    return this.isTabVisible();
  }

  protected async waitUntilClosed(): Promise<void> {
    await this.page.waitForSelector(this.tabSelector, { state: 'detached' });
  }
}
