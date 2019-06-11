import { startServer } from '@ali/ide-dev-tool/src/server';
import { MonacoModule } from '../src/node';

startServer({
  modules: [
    MonacoModule,
  ],
});
