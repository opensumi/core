import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';

export class OpenSumiDebugView extends OpenSumiPanel {
  private selector = {
    toolbarClass: "[class*='debug_configuration_toolbar']",
  };

  constructor(app: OpenSumiApp) {
    super(app, 'debug');
  }
}
