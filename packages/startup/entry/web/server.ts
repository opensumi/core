import { startServer } from '@ali/ide-dev-tool/src/server';
import { CommonNodeModules } from '../common/node';

startServer({
  modules: [
    ...CommonNodeModules,
  ],
});
