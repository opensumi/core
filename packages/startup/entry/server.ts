import { startServer } from '@ali/ide-dev-tool/src/server';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';
import { DocModelModule } from '@ali/ide-doc-model/lib/node';
import { ExpressFileServerModule } from '@ali/ide-express-file-server';
import { WorkspaceModule } from '@ali/ide-workspace/lib/node';
import { ExtensionStorageModule } from '@ali/ide-extension-storage/lib/node';

import { FeatureExtensionServerModule } from '@ali/ide-feature-extension';
import { VSCodeExtensionServerModule } from '@ali/ide-vscode-extension';

import { ThemeModule } from '@ali/ide-theme';
import { CoreExtensionServerModule } from '@ali/ide-core-extension';

import { ProcessModule } from '@ali/ide-process';

import { SearchModule } from '@ali/ide-search';

startServer({
  modules: [
    FileServiceModule,
    DocModelModule,
    ExpressFileServerModule,
    FeatureExtensionServerModule,
    VSCodeExtensionServerModule,
    WorkspaceModule,
    ExtensionStorageModule,
    // CoreExtensionServerModule,
    ProcessModule,
    SearchModule,
  ],
});
