import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';

export class OpenSumiOutputView extends OpenSumiPanel {
  constructor(app: OpenSumiApp) {
    super(app, 'OUTPUT');
  }

  async setChannel(type: string) {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const titleBar = await this.view?.$('[class*="panel_title_bar___"]');
    const select = await titleBar?.$('.kt-select-option');
    if (select) {
      await select.click();
      const wrapper = await titleBar?.$('.kt-select-options');
      const options = await wrapper?.$$('span');

      if (!options) {
        return;
      }
      for (const option of options) {
        const text = await option.textContent();
        if (text === type) {
          await option.click();
          return;
        }
      }
    }
  }

  async getCurrentContent() {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const content = await this.view?.$('[class*="output___"]');
    const lines = await content?.$$('.view-line');
    if (!lines) {
      return;
    }
    let text = '';
    for (const line of lines) {
      const lineText = await line.textContent();
      text += lineText + '\n';
    }
    return text;
  }

  async clean() {
    const button = await this.getAction('Clear Output Panel');
    await button?.click();
  }

  async getAction(name: string) {
    const visible = await this.isVisible();
    if (!visible) {
      await this.open();
    }
    const titleBar = await this.view?.$('[class*="panel_title_bar___"]');
    const actions = await titleBar?.$$('[class*="titleActions___"]');
    if (!actions) {
      return;
    }
    for (const action of actions) {
      const items = await action.$$('[class*="iconAction__"]');
      for (const item of items) {
        const title = await item.getAttribute('title');
        if (title === name) {
          return item;
        }
      }
    }
  }
}
