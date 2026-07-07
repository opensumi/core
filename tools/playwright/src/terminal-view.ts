import { OpenSumiApp } from './app';
import { OpenSumiContextMenu } from './context-menu';
import { OpenSumiPanel } from './panel';

type TerminalType = 'bash' | 'zsh' | 'Javascript Debug Terminal';

export class OpenSumiTerminalView extends OpenSumiPanel {
  constructor(app: OpenSumiApp) {
    super(app, 'TERMINAL');
  }

  async waitForTerminalReady() {
    await this.waitForVisible(10000);
    const terminalSelector = `${this.viewSelector} .xterm-screen, ${this.viewSelector} .xterm-rows, ${this.viewSelector} textarea.xterm-helper-textarea`;
    await this.page.waitForFunction(
      (selector) =>
        Array.from(document.querySelectorAll(selector)).some((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        }),
      terminalSelector,
      { timeout: 10000 },
    );
    this.view = await this.page.$(this.viewSelector);
  }

  async sendText(text: string) {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    await this.waitForTerminalReady();
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

    // 新建终端后，需要等待一段时间，否则会出现终端未创建完成的情况
    await this.app.page.waitForTimeout(5000);
  }
}
