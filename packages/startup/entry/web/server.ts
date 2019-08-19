import { startServer } from '@ali/ide-dev-tool/src/server';
import { CommonNodeModules } from '../common/node';
import { ExpressFileServerModule } from '@ali/ide-express-file-server';

startServer({
  modules: [
    ...CommonNodeModules,
    ExpressFileServerModule,
  ],
});
