import { startServer } from '@ali/ide-dev-tool/src/server';
import { DocModelModule } from '../src/node';

startServer({
  modules: [
    DocModelModule,
  ],
});
