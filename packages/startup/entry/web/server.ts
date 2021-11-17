import { startServer } from '@ide-framework/ide-dev-tool/src/server';
import { ExpressFileServerModule } from '@ide-framework/ide-express-file-server';
import { CommonNodeModules } from '../../src/node/common-modules';

startServer({
  modules: [
    ...CommonNodeModules,
    ExpressFileServerModule,
  ],
});
