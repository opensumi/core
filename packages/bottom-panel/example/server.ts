import { startServer } from '@ali/ide-dev-tool/src/server';
import { BottomPanelModule } from '../src/node';

startServer({
  modules: [
    BottomPanelModule,
  ],
});
