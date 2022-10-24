import { ElementHandle } from '@playwright/test';

import { OpenSumiApp } from './app';
import { OPENSUMI_VIEW_CONTAINERS } from './constans';
import { textContent } from './utils';
import { OpenSumiViewBase } from './view-base';

export class OpenSumiMenubar extends OpenSumiViewBase {
  static USER_KEY_TYPING_DELAY = 100;

  private _menuItems: ElementHandle[];

  selector = `#${OPENSUMI_VIEW_CONTAINERS.MENUBAR}`;

  constructor(app: OpenSumiApp) {
    super(app);
  }

  async getMenubar() {
    return await this.page.waitForSelector(this.selector);
  }

  async trigger(group: string, command: string) {
    // group maybe on of this: File, Edit, Selection, View, Go, Terminal, Help
    const sections = await this.getMenuItems();
    let item;
    for (const section of sections) {
      if ((await section.textContent()) === group) {
        item = section;
      }
    }
    if (!item) {
      return;
    }
    await item.click();
    const menu = await this.page.waitForSelector('.kt-dropdown:not(.kt-dropdown-hidden)');
    const menuItems = await menu.$$('.kt-inner-menu-item');
    for (const menu of menuItems) {
      const label = await textContent(menu.$("[class*='label__']"));
      if (command === label) {
        menu.click();
        return;
      }
    }
  }

  async getMenuItems() {
    if (!this._menuItems) {
      return await (await this.getMenubar())?.$$("[class^='menubar___']");
    }
    return this._menuItems;
  }
}
