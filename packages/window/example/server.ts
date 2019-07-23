import { startServer } from '@ali/ide-dev-tool/src/server';
import { WindowModule } from '../src/node';

startServer({
  modules: [
    WindowModule,
  ],
});
