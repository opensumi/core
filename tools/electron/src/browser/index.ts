const win = window as any;
win.Buffer = win.BufferBridge;
if (!(window as any).process) {
  (window as any).process = { browser: true, env: (window as any).env, listener: () => [] };
}

import '@opensumi/ide-i18n';
import { ClientAddonModule } from '@opensumi/ide-addons/lib/browser';
import { CommentsModule } from '@opensumi/ide-comments/lib/browser';
import { ClientCommonModule, BrowserModule, ConstructorOf } from '@opensumi/ide-core-browser';
import { DebugModule } from '@opensumi/ide-debug/lib/browser';
import { DecorationModule } from '@opensumi/ide-decoration/lib/browser';
import { EditorModule } from '@opensumi/ide-editor/lib/browser';
import { ElectronBasicModule } from '@opensumi/ide-electron-basic/lib/browser';
import { ExplorerModule } from '@opensumi/ide-explorer/lib/browser';
// import { Terminal2Module } from '@opensumi/ide-terminal2/lib/browser';
import { OpenVsxExtensionManagerModule } from '@opensumi/ide-extension-manager/lib/browser';
import { ExtensionStorageModule } from '@opensumi/ide-extension-storage/lib/browser';
import { ExtensionModule } from '@opensumi/ide-extension/lib/browser';
import { FileSchemeModule } from '@opensumi/ide-file-scheme/lib/browser';
import { FileServiceClientModule } from '@opensumi/ide-file-service/lib/browser';
import { FileTreeNextModule } from '@opensumi/ide-file-tree-next/lib/browser';
import { KeymapsModule } from '@opensumi/ide-keymaps/lib/browser';
import { LogModule } from '@opensumi/ide-logs/lib/browser';
import { MainLayoutModule } from '@opensumi/ide-main-layout/lib/browser';
import { MarkdownModule } from '@opensumi/ide-markdown';
import { MarkersModule } from '@opensumi/ide-markers/lib/browser';
import { MenuBarModule } from '@opensumi/ide-menu-bar/lib/browser';
import { MonacoEnhanceModule } from '@opensumi/ide-monaco-enhance/lib/browser/module';
import { MonacoModule } from '@opensumi/ide-monaco/lib/browser';
import { OpenedEditorModule } from '@opensumi/ide-opened-editor/lib/browser';
import { OutlineModule } from '@opensumi/ide-outline/lib/browser';
import { OutputModule } from '@opensumi/ide-output/lib/browser';
import { OverlayModule } from '@opensumi/ide-overlay/lib/browser';
import { PreferencesModule } from '@opensumi/ide-preferences/lib/browser';
import { QuickOpenModule } from '@opensumi/ide-quick-open/lib/browser';
import { SCMModule } from '@opensumi/ide-scm/lib/browser';
import { SearchModule } from '@opensumi/ide-search/lib/browser';
import { StartupModule } from '@opensumi/ide-startup/lib/browser';
import { StaticResourceModule } from '@opensumi/ide-static-resource/lib/browser';
import { StatusBarModule } from '@opensumi/ide-status-bar/lib/browser';
import { StorageModule } from '@opensumi/ide-storage/lib/browser';
import { TaskModule } from '@opensumi/ide-task/lib/browser';
import { TerminalNextModule } from '@opensumi/ide-terminal-next/lib/browser';
import { ThemeModule } from '@opensumi/ide-theme/lib/browser';
import { ToolbarModule } from '@opensumi/ide-toolbar/lib/browser';
import { VariableModule } from '@opensumi/ide-variable/lib/browser';
import { WebviewModule } from '@opensumi/ide-webview';
import { WorkspaceEditModule } from '@opensumi/ide-workspace-edit/lib/browser';
import { WorkspaceModule } from '@opensumi/ide-workspace/lib/browser';

import { renderApp } from './app';
import { customLayoutConfig } from './layout';
// import { DemoModule } from 'modules/demo';
// import { TopbarModule } from 'modules/topbar/browser';

export const CommonBrowserModules: ConstructorOf<BrowserModule>[] = [
  MainLayoutModule,
  OverlayModule,
  LogModule,
  ClientCommonModule,
  MenuBarModule,
  MonacoModule,
  StatusBarModule,
  EditorModule,
  ExplorerModule,
  FileTreeNextModule,
  FileServiceClientModule,
  StaticResourceModule,
  SearchModule,
  FileSchemeModule,
  OutputModule,
  QuickOpenModule,
  MarkersModule,

  ThemeModule,
  WorkspaceModule,
  ExtensionStorageModule,
  StorageModule,
  OpenedEditorModule,
  OutlineModule,
  PreferencesModule,
  ToolbarModule,
  WebviewModule,
  MarkdownModule,
  WorkspaceEditModule,
  SCMModule,
  DecorationModule,
  DebugModule,
  VariableModule,
  KeymapsModule,
  TerminalNextModule,

  // Extension Modules
  ExtensionModule,
  // FeatureExtensionModule,
  OpenVsxExtensionManagerModule,
  MonacoEnhanceModule,

  // addons
  ClientAddonModule,
  CommentsModule,
  TaskModule,
];

renderApp({
  modules: [
    ...CommonBrowserModules,
    ElectronBasicModule,
    StartupModule,
    // DemoModule,
    // TopbarModule, // Topbar demo
  ],
  layoutConfig: customLayoutConfig,
});
