import { startServer } from '@ali/ide-dev-tool/src/server';
import { ActivatorPanelModule } from '../src/node';

startServer({
  modules: [
    ActivatorPanelModule,
  ],
});
