import { startServer } from '@ali/ide-dev-tool/src/server';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';
import { DocModelModule } from '@ali/ide-doc-model/lib/node';
import { ExpressFileServerModule } from '@ali/ide-express-file-server';
import { WorkspaceModule } from '@ali/ide-workspace/lib/node';
import { StorageModule } from '@ali/ide-storage/lib/node';
import { ExtensionStorageModule } from '@ali/ide-extension-storage/lib/node';

import { FeatureExtensionServerModule } from '@ali/ide-feature-extension';
import { VSCodeExtensionServerModule } from '@ali/ide-vscode-extension';

import { ProcessModule } from '@ali/ide-process';

import { SearchModule } from '@ali/ide-search';
import { Terminal2Module } from '@ali/ide-terminal2';
import { LogServiceModule } from '@ali/ide-logs/lib/node';
import { KaitianExtensionModule } from '@ali/ide-kaitian-extension';

startServer({
  modules: [
    LogServiceModule,
    FileServiceModule,
    DocModelModule,
    ExpressFileServerModule,
    FeatureExtensionServerModule,
    VSCodeExtensionServerModule,
    WorkspaceModule,
    ExtensionStorageModule,
    StorageModule,
    // CoreExtensionServerModule,
    ProcessModule,
    SearchModule,
    Terminal2Module,
    KaitianExtensionModule,
  ],
});
