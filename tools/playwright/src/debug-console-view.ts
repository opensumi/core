import { OpenSumiApp } from './app';
import { OpenSumiContextMenu } from './context-menu';
import { OpenSumiPanel } from './panel';

export class OpenSumiDebugConsoleView extends OpenSumiPanel {
  constructor(app: OpenSumiApp) {
    super(app, 'DEBUG-CONSOLE');
  }

  async getOutputContainer() {
    return this.view?.$('[class*="debug_console_output__"]');
  }

  async openConsoleContextMenu() {
    const view = await this.getOutputContainer();
    if (!view) {
      return;
    }
    return OpenSumiContextMenu.open(this.app, async () => view);
  }
}
