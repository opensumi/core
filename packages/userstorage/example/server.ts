import { startServer } from '@ali/ide-dev-tool/src/server';
import { UserstorageModule } from '../src/node';

startServer({
  modules: [
    UserstorageModule,
  ],
});
