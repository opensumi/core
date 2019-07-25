import { startServer } from './server';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';
import { DocModelModule } from '@ali/ide-doc-model/lib/node';
import { ExpressFileServerModule } from '@ali/ide-express-file-server';

import { FeatureExtensionServerModule } from '@ali/ide-feature-extension';
import { VSCodeExtensionServerModule } from '@ali/ide-vscode-extension';

import { ThemeModule } from '@ali/ide-theme';
import { CoreExtensionServerModule } from '@ali/ide-core-extension';

import { ProcessModule } from '@ali/ide-process';

import { SearchModule } from '@ali/ide-search';
import { WorkspaceModule } from '@ali/ide-workspace/lib/node';

startServer({
  modules: [
    FileServiceModule,
    DocModelModule,
    FeatureExtensionServerModule,
    VSCodeExtensionServerModule,
    // CoreExtensionServerModule,
    ProcessModule,
    SearchModule,
    WorkspaceModule,
  ],
});
