import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { FileTreeModule } from '../../file-tree/src/browser';
import { MenuBarModule } from '../../menu-bar/src/browser';
import { MainLayoutModule } from '../src/browser';
const moduleInstance = new MainLayoutModule();

renderApp(moduleInstance, [
  new MenuBarModule(),
  new FileTreeModule(),
]);
