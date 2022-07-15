import { ElementHandle } from '@playwright/test';

import { isMacintosh } from '@opensumi/ide-core-browser';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';

import { OpenSumiViewBase } from './view-base';

export class OpenSumiCommandPalette extends OpenSumiViewBase {
  static USER_KEY_TYPING_DELAY = 100;

  async open() {
    await this.page.keyboard.press(isMacintosh ? 'Meta+Shift+p' : 'Control+Shift+p');
    await this.page.waitForSelector(VIEW_CONTAINERS.QUICKPICK);
  }

  async isOpen(): Promise<boolean> {
    try {
      await this.page.waitForSelector(VIEW_CONTAINERS.QUICKPICK, { timeout: 5000 });
    } catch (err) {
      return false;
    }
    return true;
  }

  async trigger(...commandName: string[]): Promise<void> {
    for (const command of commandName) {
      await this.triggerSingleCommand(command);
    }
  }

  protected async triggerSingleCommand(commandName: string): Promise<void> {
    if (!(await this.isOpen())) {
      this.open();
    }
    let selected = await this.selectedCommand();
    while (!((await selected?.getAttribute('aria-label')) === commandName)) {
      await this.page.keyboard.press('ArrowDown');
      selected = await this.selectedCommand();
    }
    await this.page.keyboard.press('Enter');
  }

  async type(command: string): Promise<void> {
    if (!(await this.isOpen())) {
      this.open();
    }
    const input = await this.page.waitForSelector(VIEW_CONTAINERS.QUICKPICK_INPUT);
    if (input != null) {
      await input.focus();
      await input.type(command, { delay: OpenSumiCommandPalette.USER_KEY_TYPING_DELAY });
    }
  }

  protected async selectedCommand(): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    const command = await this.page.waitForSelector(VIEW_CONTAINERS.QUICKPICK);
    if (!command) {
      throw new Error('No selected command found!');
    }
    return command.$(`.${VIEW_CONTAINERS.QUICKPICK_ITEM} [class^=item_selected]`);
  }
}
