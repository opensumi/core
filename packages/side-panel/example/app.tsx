import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { LeftPanelModule } from '../src/browser/left-panel-module';
const moduleInstance = new LeftPanelModule();
renderApp(moduleInstance);
