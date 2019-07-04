import { startServer } from '@ali/ide-dev-tool/src/server';
import { ThemeModule } from '../src/node';

startServer({
  modules: [
    ThemeModule,
  ],
});
