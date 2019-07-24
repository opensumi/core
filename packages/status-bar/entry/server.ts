import { startServer } from '@ali/ide-dev-tool/src/server';
import { StatusBarModule } from '../src/node';

startServer({
  modules: [
    StatusBarModule,
  ],
});
