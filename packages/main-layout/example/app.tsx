import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { DocModelModule } from '@ali/ide-doc-model/lib/browser';
import { MonacoModule } from '../../monaco/src/browser';
import { FileTreeModule } from '../../file-tree/src/browser';
import { MenuBarModule } from '../../menu-bar/src/browser';
import { MainLayoutModule } from '../src/browser';
import { EditorModule } from '../../editor/src/browser';
import { StatusBarModule } from '../../status-bar/src/browser';
import { TerminalModule } from '../../terminal/src/browser';
import { AppLogicModule } from './app.module';
import { FileServiceClientModule } from '../../file-service/src/browser';
import { LanguageModule } from '../../language/src/browser';

renderApp({
  modules: [
    MainLayoutModule,
    MenuBarModule,
    FileTreeModule,
    MonacoModule,
    DocModelModule,
    EditorModule,
    StatusBarModule,
    AppLogicModule,
    TerminalModule,
    FileServiceClientModule,
    LanguageModule,
    // SidePanelModule,
  ],
});
