import { startServer } from '@ali/ide-dev-tool/src/server';
import { ExpressFileServerModule } from '@ali/ide-express-file-server';
import { CommonNodeModules } from '../../src/node/common-modules';

startServer({
  modules: [
    ...CommonNodeModules,
    ExpressFileServerModule,
  ],
});
