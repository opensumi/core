import { OpenSumiApp } from './app';
import { OpenSumiContextMenu } from './context-menu';
import { OpenSumiPanel } from './panel';

type TerminalType = 'bash' | 'zsh' | 'Javascript Debug Terminal';

export class OpenSumiTerminalView extends OpenSumiPanel {
  constructor(app: OpenSumiApp) {
    super(app, 'TERMINAL');
  }

  async sendText(text: string) {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    await this.focus();
    const box = await this.view?.boundingBox();
    if (box) {
      await this.app.page.mouse.click(box.x + box?.width / 2, box.y + box?.height / 2);
    }
    await this.page.keyboard.type(text);
    await this.app.page.keyboard.press('Enter');
  }

  async createTerminalByType(type: TerminalType) {
    const buttonWrapper = await this.view?.$('[class*="item_wrapper__"]');
    const buttons = await buttonWrapper?.$$('.kaitian-icon');
    if (!buttons) {
      return;
    }
    let button;
    for (const item of buttons) {
      const title = await item.getAttribute('title');
      if (title === 'Create terminal by type') {
        button = item;
        break;
      }
    }
    if (!button) {
      return;
    }
    await button.click();
    const menu = new OpenSumiContextMenu(this.app);
    await menu.waitForVisible();
    await menu.clickMenuItem(type);

    await this.app.page.waitForTimeout(1000);
  }
}
