import { startServer } from '@ali/ide-dev-tool/src/server';
import { GitModule } from '../src/node';
startServer({
  modules: [ GitModule ],
});
