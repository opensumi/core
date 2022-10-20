import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';

export class OpenSumiTerminal extends OpenSumiPanel {
  constructor(app: OpenSumiApp) {
    super(app, 'terminal');
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
}
