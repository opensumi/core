import { startServer } from '@ali/ide-dev-tool/src/server';
import { OutputModule } from '../src/node';

startServer({
  modules: [
    OutputModule,
  ],
});
