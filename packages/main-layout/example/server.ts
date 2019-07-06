import { startServer } from '@ali/ide-dev-tool/src/server';
import { FileServiceModule } from '@ali/ide-file-service';
import { DocModelModule } from '@ali/ide-doc-model/lib/node';
import { ExpressFileServerModule } from '@ali/ide-express-file-server';
import { WorkspaceModule } from '@ali/ide-workspace/lib/node';

import { FeatureExtensionServerModule } from '@ali/ide-feature-extension';
import { VSCodeExtensionServerModule } from '@ali/ide-vscode-extension';

import { ThemeModule } from '@ali/ide-theme';

startServer({
  modules: [
    FileServiceModule,
    ThemeModule,
    DocModelModule,
    ExpressFileServerModule,
    FeatureExtensionServerModule,
    VSCodeExtensionServerModule,
    WorkspaceModule,
  ],
});
