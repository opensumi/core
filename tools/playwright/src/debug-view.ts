import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';

type DebugToolbarActionType = 'Continue' | 'Step Over' | 'Step Into' | 'Step Out' | 'Restart' | 'Stop';
export class OpenSumiDebugView extends OpenSumiPanel {
  private selector = {
    toolbarClass: "[class*='debug_configuration_toolbar___']",
    actionStartID: "[id='debug.action.start']",
  };

  constructor(app: OpenSumiApp) {
    super(app, 'DEBUG');
  }

  async getDebugToolbar() {
    return this.page.$('[class*="debug_toolbar_wrapper__"]');
  }

  async start(): Promise<void> {
    const toolbarLocator = this.app.page.locator(this.selector.toolbarClass);
    if (!toolbarLocator) {
      return;
    }

    const element = await toolbarLocator.elementHandle();
    const startIcon = await element?.$(this.selector.actionStartID);
    await startIcon?.click();
  }

  async getToobarAction(action: DebugToolbarActionType) {
    const toolbar = await this.getDebugToolbar();
    const buttons = await toolbar?.$$('[class*="debug_action__"]');
    if (!buttons) {
      return;
    }
    for (const button of buttons) {
      const title = await button.getAttribute('title');
      if (title === action) {
        return button;
      }
    }
  }

  async stop() {
    const action = await this.getToobarAction('Stop');
    await action?.click();
  }

  async continue() {
    const action = await this.getToobarAction('Continue');
    await action?.click();
  }

  async restart() {
    const action = await this.getToobarAction('Restart');
    await action?.click();
  }

  async stepInto() {
    const action = await this.getToobarAction('Step Into');
    await action?.click();
  }

  async stepOver() {
    const action = await this.getToobarAction('Step Over');
    await action?.click();
  }

  async stepOut() {
    const action = await this.getToobarAction('Step Out');
    await action?.click();
  }
}
