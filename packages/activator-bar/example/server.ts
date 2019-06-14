import { startServer } from '@ali/ide-dev-tool/src/server';
import { ActivatorBarModule } from '../src/node';
startServer({
  modules: [
    ActivatorBarModule,
  ],
});
