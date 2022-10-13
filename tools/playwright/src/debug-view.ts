import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';

export class OpenSumiDebugView extends OpenSumiPanel {
  constructor(app: OpenSumiApp) {
    super(app, 'debug');
  }
}
