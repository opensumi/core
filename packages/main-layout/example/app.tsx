import { renderApp } from '@ali/ide-dev-tool/src/dev-app';

import '@ali/ide-main-layout/lib/browser';
import '@ali/ide-menu-bar/lib/browser';
import '@ali/ide-monaco/lib/browser';
import '@ali/ide-doc-model/lib/browser';
import '@ali/ide-status-bar/lib/browser';
import '@ali/ide-editor/lib/browser';
import '@ali/ide-file-tree/lib/browser';
import '@ali/ide-terminal/lib/browser';
import '@ali/ide-activator-bar/lib/browser';
import '@ali/ide-activator-panel/lib/browser';
import '@ali/ide-file-service/lib/browser';
import '@ali/ide-static-resource/lib/browser';
import '@ali/ide-express-file-server/lib/browser';
import '@ali/ide-language/lib/browser';
import '@ali/ide-git/lib/browser';
import '@ali/ide-bottom-panel/lib/browser';
import '@ali/ide-search/lib/browser';
import '@ali/ide-file-scheme/lib/browser';
import '@ali/ide-output/lib/browser';

import {
  MainLayoutModule,
  MenuBarModule,
  MonacoModule,
  DocModelModule,
  StatusBarModule,
  EditorModule,
  FileTreeModule,
  TerminalModule,
  ActivatorBarModule,
  ActivatorPanelModule,
  FileServiceClientModule,
  StaticResourceModule,
  ExpressFileServerModule,
  LanguageModule,
  GitModule,
  BottomPanelModule,
  SearchModule,
  FileSchemeModule,
  OutputModule,
} from '@ali/ide-common-config';

// TODO 使用common的slot配置
const layoutConfig = {
  top: {
    modules: [MenuBarModule],
  },
  left: {
    modules: [FileTreeModule, SearchModule],
  },
  right: {
    modules: [],
  },
  main: {
    modules: [EditorModule],
  },
  bottom: {
    modules: [TerminalModule, OutputModule],
  },
  bottomBar: {
    modules: [StatusBarModule],
  },
};

renderApp({
  modules: [
    MainLayoutModule,
    MenuBarModule,
    MonacoModule,
    DocModelModule,
    StatusBarModule,
    EditorModule,
    FileTreeModule,
    TerminalModule,
    ActivatorBarModule,
    ActivatorPanelModule,
    FileServiceClientModule,
    StaticResourceModule,
    ExpressFileServerModule,
    LanguageModule,
    // GitModule,
    BottomPanelModule,
    SearchModule,
    // AppLogicModule,
    FileSchemeModule,
    OutputModule,
  ],
  layoutConfig,
});
