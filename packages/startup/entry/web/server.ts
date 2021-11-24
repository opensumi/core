import { startServer } from '@opensumi/ide-dev-tool/src/server';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server';
import { CommonNodeModules } from '../../src/node/common-modules';

startServer({
  modules: [
    ...CommonNodeModules,
    ExpressFileServerModule,
  ],
});
