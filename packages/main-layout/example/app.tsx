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
import { ActivatorBarModule } from '../../activator-bar/src/browser';
import { ActivatorPanelModule } from '../../activator-panel/src/browser';
import { FileServiceClientModule } from '../../file-service/src/browser';
import { StaticResourceModule } from '@ali/ide-static-resource/lib/browser';
import { ExpressFileServerModule } from '@ali/ide-express-file-server/lib/browser';
import { LanguageModule } from '../../language/src/browser';
import { SearchModule } from '../../search/src/browser';

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
    StaticResourceModule,
    ExpressFileServerModule,
    LanguageModule,
    // GitModule,
    SearchModule,
    AppLogicModule,
  ],
});
