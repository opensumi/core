import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { DocModelModule } from '@ali/ide-doc-model/lib/browser';
import { MonacoModule } from '../../monaco/src/browser';
import { FileTreeModule } from '../../file-tree/src/browser';
import { MenuBarModule } from '../../menu-bar/src/browser';
import { MainLayoutModule } from '../src/browser';
import { EditorModule } from '../../editor/src/browser';
import { StatusBarModule } from '../../status-bar/src/browser';
import { TerminalModule } from '../../terminal/src/browser';
import { AppLogicContribution } from './app.contribution';
import { ActivatorBarModule } from '../../activator-bar/src/browser';
import { ActivatorPanelModule } from '../../activator-panel/src/browser';
import { FileServiceClientModule } from '../../file-service/src/browser';

renderApp({
  modules: [
    MainLayoutModule,
    MenuBarModule,
    MonacoModule,
    DocModelModule,
    EditorModule,
    FileTreeModule,
    StatusBarModule,
    TerminalModule,
    ActivatorBarModule,
    ActivatorPanelModule,
    FileServiceClientModule,
  ],
  contributions: [
    AppLogicContribution,
  ],
});
