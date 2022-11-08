import { ElementHandle } from '@playwright/test';

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
    await this.app.quickOpenPalette.type('view ');
    await this.app.quickOpenPalette.trigger(this.viewId);
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

  async waitForVisible() {
    await this.page.waitForSelector(this.viewSelector, { state: 'visible' });
  }
}
