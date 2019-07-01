import { startServer } from '@ali/ide-dev-tool/src/server';
import { ExplorerModule } from '../src/node';

startServer({
  modules: [
    ExplorerModule,
  ],
});
