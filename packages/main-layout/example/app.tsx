import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { DocModelModule } from '@ali/ide-doc-model/lib/browser';
import { MonacoModule } from '../../monaco/src/browser';
import { LeftPanelModule } from '../../side-panel/src/browser/left-panel-module';
import { RightPanelModule } from '../../side-panel/src/browser/right-panel-module';
import { FileTreeModule } from '../../file-tree/src/browser';
import { MenuBarModule } from '../../menu-bar/src/browser';
import { MainLayoutModule } from '../src/browser';
import { EditorModule } from '../../editor/src/browser';
import { StatusBarModule } from '../../status-bar/src/browser';
import { TerminalModule } from '../../terminal/src/browser';
import { AppLogicModule } from './app.module';

renderApp({
  modules: [
    MainLayoutModule,
    MenuBarModule,
    MonacoModule,
    DocModelModule,
    EditorModule,
    LeftPanelModule,
    RightPanelModule,
    FileTreeModule,
    StatusBarModule,
    AppLogicModule,
    TerminalModule,
    // SidePanelModule,
  ],
});
