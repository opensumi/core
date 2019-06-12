import { startServer } from '@ali/ide-dev-tool/src/server';
import { FileSchemeModule } from '../src/node';

startServer({
  modules: [
    FileSchemeModule,
  ],
});
