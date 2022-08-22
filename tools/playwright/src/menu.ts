import { OpenSumiMenuItem } from './menu-item';
import { OpenSumiViewBase } from './view-base';

export class OpenSumiMenu extends OpenSumiViewBase {
  selector = '.rc-trigger-popup .kt-inner-menu';

  protected async menuElementHandle() {
    return this.page.waitForSelector(this.selector);
  }

  async waitForVisible() {
    await this.page.waitForSelector(this.selector, { state: 'visible' });
  }

  async isOpen() {
    const menu = await this.menuElementHandle();
    return !!menu && menu.isVisible();
  }

  async close() {
    if (!(await this.isOpen())) {
      return;
    }
    await this.page.mouse.click(0, 0);
    await this.page.waitForSelector(this.selector, { state: 'detached' });
  }

  async menuItems() {
    const menuHandle = await this.menuElementHandle();
    if (!menuHandle) {
      return [];
    }
    const items = await menuHandle.$$('.kt-inner-menu-item');
    return items.map((element) => new OpenSumiMenuItem(element));
  }

  async clickMenuItem(name: string) {
    return (await this.page.waitForSelector(this.menuItemSelector(name))).click();
  }

  async menuItemByName(name: string) {
    const menuItems = await this.menuItems();
    for (const item of menuItems) {
      const label = await item.label();
      if (label === name) {
        return item;
      }
    }
    return undefined;
  }

  async menuItemByIndex(index: number) {
    const menuItems = await this.menuItems();
    if (menuItems.length > index) {
      return menuItems[index];
    }
    return undefined;
  }

  protected menuItemSelector(label = '') {
    return `.kt-inner-menu-item [class*='label___'] >> text=${label}`;
  }

  async visibleMenuItems() {
    const menuItems = await this.menuItems();
    const labels = await Promise.all(menuItems.map((item) => item.label()));
    return labels.filter((label) => !!label);
  }
}
