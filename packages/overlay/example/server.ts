import { startServer } from '@ali/ide-dev-tool/src/server';
import { OverlayModule } from '../src/node';

startServer({
  modules: [
    OverlayModule,
  ],
});
