import { MainLayoutModule } from '@ali/ide-main-layout/lib/browser';
import { LogModule } from '@ali/ide-logs/lib/browser';
import { MonacoModule } from '@ali/ide-monaco/lib/browser';
import { EditorModule } from '@ali/ide-editor/lib/browser';
import { StatusBarModule } from '@ali/ide-status-bar/lib/browser';
import { ClientCommonModule, BrowserModule } from '@ali/ide-core-browser';
import { CoreQuickOpenModule } from '@ali/ide-quick-open/lib/browser';
import { ConstructorOf } from '@ali/ide-core-common';
// import { FileTreeNextModule } from '@ali/ide-file-tree-next';
// import { DecorationModule } from '@ali/ide-decoration/lib/browser';

export const CommonBrowserModules: ConstructorOf<BrowserModule>[] = [
  MainLayoutModule,
  LogModule,
  ClientCommonModule,
  StatusBarModule,
  MonacoModule,
  EditorModule,
  CoreQuickOpenModule,
  // FileTreeNextModule,
  // DecorationModule,
];
