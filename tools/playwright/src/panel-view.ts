import { ElementHandle } from '@playwright/test';

import { OpenSumiApp } from './app';
import { isElementVisible, containsClass } from './tests/utils';
import { OpenSumiViewBase } from './view-base';

export interface OpenSumiPanelViewInfo {
  tabSelector: string;
  viewSelector: string;
  name?: string;
}

export class OpenSumiPanelView extends OpenSumiViewBase {
  constructor(app: OpenSumiApp, private readonly data: OpenSumiPanelViewInfo) {
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

  async open(): Promise<OpenSumiPanelView> {
    if (!this.name) {
      throw new Error('View name must be specified to open via command palette');
    }
    await this.app.quickCommandPalette.type('View: Open View');
    await this.app.quickCommandPalette.trigger('View: Open View...', this.name);
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

  protected async waitUntilClosed(): Promise<void> {
    await this.page.waitForSelector(this.tabSelector, { state: 'detached' });
  }
}
