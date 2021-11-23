const win = window as any;
win.Buffer = win.BufferBridge;
if (!(window as any).process) {
  (window as any).process = { browser: true, env: (window as any).env, listener: () => [] };
}

import '@ide-framework/ide-i18n';
import { ElectronBasicModule } from '@ide-framework/ide-electron-basic/lib/browser';
import { renderApp } from './app';
import { StartupModule } from '@ide-framework/ide-startup/lib/browser';

import { MainLayoutModule } from '@ide-framework/ide-main-layout/lib/browser';
import { MenuBarModule } from '@ide-framework/ide-menu-bar/lib/browser';
import { MonacoModule } from '@ide-framework/ide-monaco/lib/browser';
import { WorkspaceModule } from '@ide-framework/ide-workspace/lib/browser';
import { StatusBarModule } from '@ide-framework/ide-status-bar/lib/browser';
import { EditorModule } from '@ide-framework/ide-editor/lib/browser';
import { ExplorerModule } from '@ide-framework/ide-explorer/lib/browser';
import { FileTreeNextModule } from '@ide-framework/ide-file-tree-next/lib/browser';
import { FileServiceClientModule } from '@ide-framework/ide-file-service/lib/browser';
import { StaticResourceModule } from '@ide-framework/ide-static-resource/lib/browser';
import { SearchModule } from '@ide-framework/ide-search/lib/browser';
import { FileSchemeModule } from '@ide-framework/ide-file-scheme/lib/browser';
import { OutputModule } from '@ide-framework/ide-output/lib/browser';
import { QuickOpenModule } from '@ide-framework/ide-quick-open/lib/browser';
import { ClientCommonModule, BrowserModule, ConstructorOf } from '@ide-framework/ide-core-browser';
import { ThemeModule } from '@ide-framework/ide-theme/lib/browser';

import { OpenedEditorModule } from '@ide-framework/ide-opened-editor/lib/browser';
import { OutlineModule } from '@ide-framework/ide-outline/lib/browser';
import { PreferencesModule } from '@ide-framework/ide-preferences/lib/browser';
import { ToolbarModule } from '@ide-framework/ide-toolbar/lib/browser';
import { OverlayModule } from '@ide-framework/ide-overlay/lib/browser';
import { ExtensionStorageModule } from '@ide-framework/ide-extension-storage/lib/browser';
import { StorageModule } from '@ide-framework/ide-storage/lib/browser';
import { SCMModule } from '@ide-framework/ide-scm/lib/browser';

import { MarkersModule } from '@ide-framework/ide-markers/lib/browser';

// import { Terminal2Module } from '@ide-framework/ide-terminal2/lib/browser';

import { WebviewModule } from '@ide-framework/ide-webview';
import { MarkdownModule } from '@ide-framework/ide-markdown';

import { LogModule } from '@ide-framework/ide-logs/lib/browser';
import { WorkspaceEditModule } from '@ide-framework/ide-workspace-edit/lib/browser';
import { KaitianExtensionModule } from '@ide-framework/ide-extension/lib/browser';
import { DecorationModule } from '@ide-framework/ide-decoration/lib/browser';
import { DebugModule } from '@ide-framework/ide-debug/lib/browser';
import { VariableModule } from '@ide-framework/ide-variable/lib/browser';
import { KeymapsModule } from '@ide-framework/ide-keymaps/lib/browser';
import { MonacoEnhanceModule } from '@ide-framework/ide-monaco-enhance/lib/browser/module';

import { OpenVsxExtensionManagerModule } from '@ide-framework/ide-extension-manager/lib/browser';
import { TerminalNextModule } from '@ide-framework/ide-terminal-next/lib/browser';
import { CommentsModule } from '@ide-framework/ide-comments/lib/browser';

import { ClientAddonModule } from '@ide-framework/ide-addons/lib/browser';
import { TaskModule } from '@ide-framework/ide-task/lib/browser';
import { customLayoutConfig } from './layout';
import { DemoModule } from 'modules/demo';
import { TopbarModule } from 'modules/topbar/browser';

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
  KaitianExtensionModule,
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
    DemoModule,
    // TopbarModule, // Topbar demo
  ],
  layoutConfig: customLayoutConfig,
});
