import '@ali/ide-i18n/lib/browser';
import { defaultConfig } from '@ali/ide-main-layout/lib/browser/default-config';
// TODO 动态引入
import { MainLayoutModule } from '@ali/ide-main-layout/lib/browser';
import { MenuBarModule } from '@ali/ide-menu-bar/lib/browser';
import { MonacoModule } from '@ali/ide-monaco/lib/browser';
import { DocModelModule } from '@ali/ide-doc-model/lib/browser';
import { StatusBarModule } from '@ali/ide-status-bar/lib/browser';
import { EditorModule } from '@ali/ide-editor/lib/browser';
import { ExplorerModule } from '@ali/ide-explorer/lib/browser';
import { FileTreeModule } from '@ali/ide-file-tree/lib/browser';
import { TerminalModule } from '@ali/ide-terminal/lib/browser';
import { ActivatorBarModule } from '@ali/ide-activator-bar/lib/browser';
import { ActivatorPanelModule } from '@ali/ide-activator-panel/lib/browser';
import { FileServiceClientModule } from '@ali/ide-file-service/lib/browser';
import { StaticResourceModule } from '@ali/ide-static-resource/lib/browser';
import { ExpressFileServerModule } from '@ali/ide-express-file-server/lib/browser';
import { LanguageModule } from '@ali/ide-language/lib/browser';
import { BottomPanelModule } from '@ali/ide-bottom-panel/lib/browser';
import { SearchModule } from '@ali/ide-search/lib/browser';
import { FileSchemeModule } from '@ali/ide-file-scheme/lib/browser';
import { OutputModule } from '@ali/ide-output/lib/browser';
import { QuickOpenModule } from '@ali/ide-quick-open/lib/browser';
import { ClientCommonModule } from '@ali/ide-core-browser';
import { ThemeModule } from '@ali/ide-theme/lib/browser';
import { FeatureExtensionModule } from '@ali/ide-feature-extension/lib/browser';
import { VscodeExtensionModule } from '@ali/ide-vscode-extension/lib/browser';
import { ActivationEventModule } from '@ali/ide-activation-event';
import { WorkspaceModule } from '@ali/ide-workspace/lib/browser';
import { OpenedEditorModule } from '@ali/ide-opened-editor/src/browser';
import { PreferencesModule } from '@ali/ide-preferences/src/browser';
import { UserstorageModule } from '@ali/ide-userstorage/src/browser';
import { ToolbarModule } from '@ali/ide-toolbar/src/browser';
import { NavigationBarModule } from '@ali/ide-navigation-bar/lib/browser';
import { OverlayModule } from '@ali/ide-overlay/lib/browser';
import { ExtensionStorageModule } from '@ali/ide-extension-storage/lib/browser';
import { GitModule } from '@ali/ide-git/lib/browser';

import { StartupModule } from '../src/browser';
import { CoreExtensionModule } from '@ali/ide-core-extension/src/browser';
import { WindowModule } from '@ali/ide-window/lib/browser';
import { renderApp } from './render-app';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';

renderApp({
  modules: [
    MainLayoutModule,
    OverlayModule,
    ClientCommonModule,
    MenuBarModule,
    MonacoModule,
    DocModelModule,
    StatusBarModule,
    EditorModule,
    ExplorerModule,
    FileTreeModule,
    TerminalModule,
    ActivatorBarModule,
    ActivatorPanelModule,
    FileServiceClientModule,
    StaticResourceModule,
    ExpressFileServerModule,
    LanguageModule,
    BottomPanelModule,
    SearchModule,
    FileSchemeModule,
    OutputModule,
    QuickOpenModule,
    FeatureExtensionModule,
    VscodeExtensionModule,
    ThemeModule,
    ActivationEventModule,
    WorkspaceModule,
    ExtensionStorageModule,
    // CoreExtensionModule,
    OpenedEditorModule,
    UserstorageModule,
    PreferencesModule,
    ToolbarModule,
    NavigationBarModule,
    StartupModule,
    GitModule,
    WindowModule,
  ],
  layoutConfig: defaultConfig,
});
