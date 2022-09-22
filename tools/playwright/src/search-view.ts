import { OpenSumiApp } from './app';
import { OpenSumiPanel } from './panel';

export class OpenSumiSearchView extends OpenSumiPanel {
  constructor(app: OpenSumiApp) {
    super(app, 'search');
  }
}
