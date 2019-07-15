import { startServer } from '@ali/ide-dev-tool/src/server';
import { PreferencesModule } from '../src/node';

startServer({
  modules: [
    PreferencesModule,
  ],
});
