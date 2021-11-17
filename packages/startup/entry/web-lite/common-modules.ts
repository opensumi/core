import { MainLayoutModule } from '@ide-framework/ide-main-layout/lib/browser';
import { LogModule } from '@ide-framework/ide-logs/lib/browser';
import { MonacoModule } from '@ide-framework/ide-monaco/lib/browser';
import { EditorModule } from '@ide-framework/ide-editor/lib/browser';
import { StatusBarModule } from '@ide-framework/ide-status-bar/lib/browser';
import { ClientCommonModule, BrowserModule } from '@ide-framework/ide-core-browser';
import { QuickOpenModule } from '@ide-framework/ide-quick-open/lib/browser';
import { ConstructorOf } from '@ide-framework/ide-core-common';
import { FileTreeNextModule } from '@ide-framework/ide-file-tree-next/lib/browser';
import { FileServiceClientModule } from '@ide-framework/ide-file-service/lib/browser';
import { ThemeModule } from '@ide-framework/ide-theme/lib/browser';
import { WorkspaceModule } from '@ide-framework/ide-workspace/lib/browser';
import { ExtensionStorageModule } from '@ide-framework/ide-extension-storage/lib/browser';
import { StorageModule } from '@ide-framework/ide-storage/lib/browser';
import { OpenedEditorModule } from '@ide-framework/ide-opened-editor/lib/browser';
import { ExplorerModule } from '@ide-framework/ide-explorer/lib/browser';
import { DecorationModule } from '@ide-framework/ide-decoration/lib/browser';
import { PreferencesModule } from '@ide-framework/ide-preferences/lib/browser';
import { MenuBarModule } from '@ide-framework/ide-menu-bar/lib/browser';
import { OverlayModule } from '@ide-framework/ide-overlay/lib/browser';
import { SCMModule } from '@ide-framework/ide-scm/lib/browser';
import { StaticResourceModule } from '@ide-framework/ide-static-resource/lib/browser';
import { WorkspaceEditModule } from '@ide-framework/ide-workspace-edit/lib/browser';
import { KeymapsModule } from '@ide-framework/ide-keymaps/lib/browser';
import { KaitianExtensionModule } from '@ide-framework/ide-kaitian-extension/lib/browser';
import { CommentsModule } from '@ide-framework/ide-comments/lib/browser';
import { WebviewModule } from '@ide-framework/ide-webview/lib/browser';
import { OutputModule } from '@ide-framework/ide-output/lib/browser';

import { BrowserFileSchemeModule } from './overrides/browser-file-scheme';

export const CommonBrowserModules: ConstructorOf<BrowserModule>[] = [
  FileServiceClientModule,
  MainLayoutModule,
  OverlayModule,
  LogModule,
  ClientCommonModule,
  StatusBarModule,
  MenuBarModule,
  MonacoModule,
  ExplorerModule,
  EditorModule,
  QuickOpenModule,
  KeymapsModule,
  FileTreeNextModule,
  ThemeModule,
  WorkspaceModule,
  ExtensionStorageModule,
  StorageModule,
  PreferencesModule,
  OpenedEditorModule,
  DecorationModule,
  SCMModule,
  StaticResourceModule,
  WorkspaceEditModule,
  CommentsModule,
  WebviewModule,
  OutputModule,
  // browser custom modules
  BrowserFileSchemeModule,
  KaitianExtensionModule,
];
