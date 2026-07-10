import { Locator } from '@playwright/test';

import { isMacintosh } from '@opensumi/ide-utils';

import { OPENSUMI_VIEW_CONTAINERS } from './constans';
import { OpenSumiViewBase } from './view-base';

export class OpenSumiCommandPalette extends OpenSumiViewBase {
  static USER_KEY_TYPING_DELAY = 200;

  async open() {
    await this.page.keyboard.press(isMacintosh ? 'Meta+Shift+p' : 'Control+Shift+p');
    await this.page.waitForSelector(`#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK}`, { state: 'visible' });
  }

  async isOpen(): Promise<boolean> {
    try {
      await this.page.waitForSelector(`#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK}`, { state: 'visible', timeout: 5000 });
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
      await this.open();
    }

    const existingInput = await this.quickpickInput()
      .inputValue()
      .catch(() => '');
    if (!this.hasMeaningfulFilter(existingInput)) {
      await this.filterCommand(commandName);
    }

    try {
      await this.page.waitForFunction(
        ({ itemSelector, quickpickSelector, expectedLabel }) =>
          Array.from(document.querySelectorAll(`${quickpickSelector} ${itemSelector}`)).some(
            (item) => item.getAttribute('aria-label')?.trim() === expectedLabel,
          ),
        {
          expectedLabel: commandName,
          itemSelector: `#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK_ITEM}`,
          quickpickSelector: `#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK}`,
        },
        { timeout: 15000 },
      );
    } catch (err) {
      const labels = await this.visibleCommandLabels();
      const inputValue = await this.quickpickInput()
        .inputValue()
        .catch(() => '');
      throw new Error(
        `Command palette item "${commandName}" was not found after filtering. Input: "${inputValue}". Visible items: ${labels.join(
          ', ',
        )}`,
      );
    }

    const labels = await this.visibleCommandLabels();
    const index = labels.findIndex((label) => label === commandName);
    if (index === -1) {
      throw new Error(
        `Command palette item "${commandName}" disappeared before selection. Visible items: ${labels.join(', ')}`,
      );
    }

    const command = this.quickpickItems().nth(index);
    await command.locator("[class*='item_label_container']").first().click();
  }

  async type(command: string): Promise<void> {
    if (!(await this.isOpen())) {
      await this.open();
    }
    const input = await this.page.waitForSelector(`#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK_INPUT}`);
    if (input != null) {
      await input.focus();
      await input.type(command, { delay: OpenSumiCommandPalette.USER_KEY_TYPING_DELAY });
    }
  }

  private quickpickInput(): Locator {
    return this.page.locator(`#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK_INPUT}`);
  }

  private quickpickItems(): Locator {
    return this.page.locator(`#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK} #${OPENSUMI_VIEW_CONTAINERS.QUICKPICK_ITEM}`);
  }

  private async filterCommand(commandName: string): Promise<void> {
    const input = this.quickpickInput();
    await input.waitFor({ state: 'visible' });
    await this.page.waitForFunction(
      (selector) => {
        const input = document.querySelector<HTMLInputElement>(selector);
        return !!input && !input.readOnly && !input.disabled;
      },
      `#${OPENSUMI_VIEW_CONTAINERS.QUICKPICK_INPUT}`,
      { timeout: 10000 },
    );
    await input.fill('');
    await input.fill(commandName);
  }

  private hasMeaningfulFilter(inputValue: string): boolean {
    return inputValue.trim().replace(/^>\s*/, '').length > 0;
  }

  private async visibleCommandLabels(): Promise<string[]> {
    return this.quickpickItems().evaluateAll((items) =>
      items.map((item) => item.getAttribute('aria-label')?.trim()).filter((label): label is string => !!label),
    );
  }
}
