import { ElementHandle } from '@playwright/test';

import { OpenSumiApp } from './app';
import { OpenSumiMenu } from './menu';

export class OpenSumiContextMenu extends OpenSumiMenu {
  public static async openAt(app: OpenSumiApp, x: number, y: number): Promise<OpenSumiContextMenu> {
    await app.page.mouse.move(x, y);
    await app.page.mouse.click(x, y, { button: 'right' });
    return OpenSumiContextMenu.returnWhenVisible(app);
  }

  public static async open(
    app: OpenSumiApp,
    element: () => Promise<ElementHandle<SVGElement | HTMLElement>>,
  ): Promise<OpenSumiContextMenu> {
    const elementHandle = await element();
    await elementHandle.click({ button: 'right' });
    return OpenSumiContextMenu.returnWhenVisible(app);
  }

  private static async returnWhenVisible(app: OpenSumiApp): Promise<OpenSumiContextMenu> {
    const menu = new OpenSumiContextMenu(app);
    await menu.waitForVisible();
    return menu;
  }
}
