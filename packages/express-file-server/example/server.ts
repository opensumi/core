import { startServer } from '@ali/ide-dev-tool/src/server';
import { ExpressFileServerModule } from '../src/node';

startServer({
  modules: [
    ExpressFileServerModule,
  ],
});
