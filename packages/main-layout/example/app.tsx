import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { MonacoModule } from '../../monaco/src/browser';
import { SidePanelModule } from '../../side-panel/src/browser';
import { MenuBarModule } from '../../menu-bar/src/browser';
import { MainLayoutModule } from '../src/browser';
const moduleInstance = new MainLayoutModule();

renderApp(moduleInstance, [
  new MenuBarModule(),
  new SidePanelModule(),
  new MonacoModule(),
]);
