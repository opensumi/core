import { ElementHandle } from '@playwright/test';

import { OpenSumiApp } from './app';
import { OpenSumiViewBase } from './view-base';

export abstract class OpenSumiPanel extends OpenSumiViewBase {
  private view: ElementHandle<HTMLElement | SVGElement> | null;
  private whenReady: Promise<void>;

  abstract id: string;

  constructor(app: OpenSumiApp) {
    super(app);
    this.whenReady = this.init();
  }

  get viewSelector() {
    return `.${this.id}`;
  }

  async init() {
    this.view = await this.page.$(this.viewSelector);
  }

  async isVisible() {
    await this.whenReady;
    return this.view?.isVisible();
  }

  async open() {
    if (!this.id) {
      return;
    }
    await this.app.quickOpenPalette.type('view ');
    await this.app.quickOpenPalette.trigger(this.id.toLocaleUpperCase());
    await this.waitForVisible();
    return this;
  }

  async waitForVisible() {
    await this.page.waitForSelector(this.viewSelector, { state: 'visible' });
  }
}
