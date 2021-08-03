const win = window as any;
win.Buffer = win.BufferBridge;
if (!(window as any).process) {
  (window as any).process = { browser: true, env: (window as any).env, listener: () => [] };
}

import '@ali/ide-i18n/lib/browser';
import { ElectronBasicModule } from '@ali/ide-electron-basic/lib/browser';
import { renderApp } from './app';
import { StartupModule } from '@ali/ide-startup/lib/browser';

import { MainLayoutModule } from '@ali/ide-main-layout/lib/browser';
import { MenuBarModule } from '@ali/ide-menu-bar/lib/browser';
import { MonacoModule } from '@ali/ide-monaco/lib/browser';
import { WorkspaceModule } from '@ali/ide-workspace/lib/browser';
import { StatusBarModule } from '@ali/ide-status-bar/lib/browser';
import { EditorModule } from '@ali/ide-editor/lib/browser';
import { ExplorerModule } from '@ali/ide-explorer/lib/browser';
import { FileTreeNextModule } from '@ali/ide-file-tree-next/lib/browser';
import { FileServiceClientModule } from '@ali/ide-file-service/lib/browser';
import { StaticResourceModule } from '@ali/ide-static-resource/lib/browser';
import { SearchModule } from '@ali/ide-search/lib/browser';
import { FileSchemeModule } from '@ali/ide-file-scheme/lib/browser';
import { OutputModule } from '@ali/ide-output/lib/browser';
import { QuickOpenModule } from '@ali/ide-quick-open/lib/browser';
import { ClientCommonModule, BrowserModule, ConstructorOf } from '@ali/ide-core-browser';
import { ThemeModule } from '@ali/ide-theme/lib/browser';

import { OpenedEditorModule } from '@ali/ide-opened-editor/lib/browser';
import { OutlineModule } from '@ali/ide-outline/lib/browser';
import { PreferencesModule } from '@ali/ide-preferences/lib/browser';
import { ToolbarModule } from '@ali/ide-toolbar/lib/browser';
import { OverlayModule } from '@ali/ide-overlay/lib/browser';
import { ExtensionStorageModule } from '@ali/ide-extension-storage/lib/browser';
import { StorageModule } from '@ali/ide-storage/lib/browser';
import { SCMModule } from '@ali/ide-scm/lib/browser';

import { MarkersModule } from '@ali/ide-markers/lib/browser';

// import { Terminal2Module } from '@ali/ide-terminal2/lib/browser';

import { WebviewModule } from '@ali/ide-webview';
import { MarkdownModule } from '@ali/ide-markdown';

import { LogModule } from '@ali/ide-logs/lib/browser';
import { WorkspaceEditModule } from '@ali/ide-workspace-edit/lib/browser';
import { KaitianExtensionModule } from '@ali/ide-kaitian-extension/lib/browser';
import { DecorationModule } from '@ali/ide-decoration/lib/browser';
import { DebugModule } from '@ali/ide-debug/lib/browser';
import { VariableModule } from '@ali/ide-variable/lib/browser';
import { KeymapsModule } from '@ali/ide-keymaps/lib/browser';
import { MonacoEnhanceModule } from '@ali/ide-monaco-enhance/lib/browser/module';

import { ExtensionManagerModule } from '@ali/ide-extension-manager/lib/browser';
import { TerminalNextModule } from '@ali/ide-terminal-next/lib/browser';
import { CommentsModule } from '@ali/ide-comments/lib/browser';

import { ClientAddonModule } from '@ali/ide-addons/lib/browser';
import { TaskModule } from '@ali/ide-task/lib/browser';
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
  ExtensionManagerModule,
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
