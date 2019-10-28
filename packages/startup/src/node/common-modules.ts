import { NodeModule, ConstructorOf} from '@ali/ide-core-node';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';

import { WorkspaceModule } from '@ali/ide-workspace/lib/node';
import { StorageModule } from '@ali/ide-storage/lib/node';
import { ExtensionStorageModule } from '@ali/ide-extension-storage/lib/node';

import { ProcessModule } from '@ali/ide-process';

import { SearchModule } from '@ali/ide-search';
import { Terminal2Module } from '@ali/ide-terminal2/lib/node';
import { LogServiceModule } from '@ali/ide-logs/lib/node';
import { KaitianExtensionModule } from '@ali/ide-kaitian-extension';
import { DebugModule } from '@ali/ide-debug/lib/node';
import { DebugNodejsModule } from '@ali/ide-debug-nodejs/lib/node';
import { ExtensionManagerModule } from '@ali/ide-extension-manager';
import { FileSchemeNodeModule } from '@ali/ide-file-scheme/lib/node';

export const CommonNodeModules: ConstructorOf<NodeModule>[] = [
  LogServiceModule,
  FileServiceModule,
  WorkspaceModule,
  ExtensionStorageModule,
  StorageModule,
  ProcessModule,
  SearchModule,
  Terminal2Module,
  DebugModule,
  DebugNodejsModule,

  KaitianExtensionModule,
  ExtensionManagerModule,
  FileSchemeNodeModule,
];
