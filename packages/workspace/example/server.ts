import { startServer } from '@ali/ide-dev-tool/src/server';
import { WorkspaceModule } from '../src/node';

startServer({
  modules: [
    WorkspaceModule,
  ],
});
