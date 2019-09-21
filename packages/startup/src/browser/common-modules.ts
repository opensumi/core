import { MainLayoutModule } from '@ali/ide-main-layout/lib/browser';
import { MenuBarModule } from '@ali/ide-menu-bar/lib/browser';
import { MonacoModule } from '@ali/ide-monaco/lib/browser';
import { WorkspaceModule } from '@ali/ide-workspace/lib/browser';
import { StatusBarModule } from '@ali/ide-status-bar/lib/browser';
import { EditorModule } from '@ali/ide-editor/lib/browser';
import { ExplorerModule } from '@ali/ide-explorer/lib/browser';
import { FileTreeModule } from '@ali/ide-file-tree/lib/browser';
import { ActivityBarModule } from '@ali/ide-activity-bar/lib/browser';
import { ActivityPanelModule } from '@ali/ide-activity-panel/lib/browser';
import { FileServiceClientModule } from '@ali/ide-file-service/lib/browser';
import { StaticResourceModule } from '@ali/ide-static-resource/lib/browser';
import { SearchModule } from '@ali/ide-search/lib/browser';
import { FileSchemeModule } from '@ali/ide-file-scheme/lib/browser';
import { OutputModule } from '@ali/ide-output/lib/browser';
import { QuickOpenModule } from '@ali/ide-quick-open/lib/browser';
import { ClientCommonModule, BrowserModule, ConstructorOf } from '@ali/ide-core-browser';
import { ThemeModule } from '@ali/ide-theme/lib/browser';
import { FeatureExtensionModule } from '@ali/ide-feature-extension/lib/browser';
import { ActivationEventModule } from '@ali/ide-activation-event';
import { OpenedEditorModule } from '@ali/ide-opened-editor/lib/browser';
import { PreferencesModule } from '@ali/ide-preferences/lib/browser';
import { UserstorageModule } from '@ali/ide-userstorage/lib/browser';
import { ToolbarModule } from '@ali/ide-toolbar/lib/browser';
import { NavigationBarModule } from '@ali/ide-navigation-bar/lib/browser';
import { OverlayModule } from '@ali/ide-overlay/lib/browser';
import { ExtensionStorageModule } from '@ali/ide-extension-storage/lib/browser';
import { StorageModule } from '@ali/ide-storage/lib/browser';
import { SCMModule } from '@ali/ide-scm/lib/browser';

import { WindowModule } from '@ali/ide-window/lib/browser';
import { Terminal2Module } from '@ali/ide-terminal2/lib/browser';

import { WebviewModule } from '@ali/ide-webview';
import { MarkdownModule } from '@ali/ide-markdown';

import { LogModule } from '@ali/ide-logs/lib/browser';
import { WorkspaceEditModule } from '@ali/ide-workspace-edit/lib/browser';
import { KaitianExtensionModule } from '@ali/ide-kaitian-extension/lib/browser';
import { DecorationModule } from '@ali/ide-decoration/lib/browser';
import { DebugModule } from '@ali/ide-debug/lib/browser';
import { VariableModule } from '@ali/ide-variable/lib/browser';

import { ExtensionManagerModule } from '@ali/ide-extension-manager/lib/browser';

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
    FileTreeModule,
    ActivityBarModule,
    ActivityPanelModule,
    FileServiceClientModule,
    StaticResourceModule,
    SearchModule,
    FileSchemeModule,
    OutputModule,
    QuickOpenModule,

    ThemeModule,
    ActivationEventModule,
    WorkspaceModule,
    ExtensionStorageModule,
    StorageModule,
    OpenedEditorModule,
    UserstorageModule,
    PreferencesModule,
    ToolbarModule,
    WindowModule,
    Terminal2Module,
    WebviewModule,
    MarkdownModule,
    WorkspaceEditModule,
    SCMModule,
    DecorationModule,
    DebugModule,
    VariableModule,

    // Extension Modules
    KaitianExtensionModule,
    FeatureExtensionModule,
    ExtensionManagerModule,
];
