import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import '@ali/ide-status-bar';
import '';
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
