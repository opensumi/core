import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { MonacoModule } from '../../monaco/src/browser';
import { LeftPanelModule } from '../../side-panel/src/browser/left-panel-module';
import { RightPanelModule } from '../../side-panel/src/browser/right-panel-module';
import { FileTreeModule } from '../../file-tree/src/browser';
import { MenuBarModule } from '../../menu-bar/src/browser';
import { MainLayoutModule } from '../src/browser';
import { EditorModule } from '../../editor/src/browser';

renderApp({
  modules: [
    MainLayoutModule,
    MenuBarModule,
    MonacoModule,
    EditorModule,
    LeftPanelModule,
    RightPanelModule,
    FileTreeModule,
  ],
});
