import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';

export class OpenSumiDebugView extends OpenSumiPanel {
  private selector = {
    toolbarClass: "[class*='debug_configuration_toolbar___']",
    actionStartID: "[id='debug.action.start']",
  };

  constructor(app: OpenSumiApp) {
    super(app, 'debug');
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
}
