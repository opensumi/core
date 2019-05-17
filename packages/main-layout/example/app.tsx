import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { FileTreeModule } from '../../file-tree/src/browser';
import { MenuBarModule } from '../../menu-bar/src/browser';
import { MainLayoutModule } from '../src/browser';
import { EditorModule } from '../../editor/src/browser';
import { MonacoModule } from '../../monaco/src/browser';

renderApp({
  modules: [
    MainLayoutModule,
    MenuBarModule,
    FileTreeModule,
    MonacoModule,
    EditorModule,
  ]
});
