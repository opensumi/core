import { startServer } from '@ali/ide-dev-tool/src/server';
import { QuickOpenModule } from '../src/node';

startServer({
  modules: [
    QuickOpenModule,
  ],
});
