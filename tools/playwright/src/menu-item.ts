import { ElementHandle } from '@playwright/test';

import { textContent } from './utils';

export class OpenSumiMenuItem {
  constructor(protected element: ElementHandle<SVGElement | HTMLElement>) {}

  protected labelElementHandle() {
    return this.element.$("[class*='label__']");
  }

  protected shortCutElementHandle() {
    return this.element.$("[class*='shortcut__']");
  }

  async label() {
    return textContent(this.labelElementHandle());
  }

  async shortCut() {
    return textContent(this.shortCutElementHandle());
  }

  async isEnabled() {
    const classAttribute = await this.element.getAttribute('class');
    if (classAttribute === undefined || classAttribute === null) {
      return false;
    }
    return !classAttribute.includes('kt-inner-menu-item-disabled');
  }

  async click() {
    const action = await this.element.waitForSelector("[class*='menuAction__']");
    action.click({ position: { x: 10, y: 10 } });
  }

  async hover(): Promise<void> {
    return this.element.hover();
  }
}
