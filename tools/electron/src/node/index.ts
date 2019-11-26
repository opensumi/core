import { startServer } from './server';
import { CommonNodeModules } from '@ali/ide-startup/lib/node/common-modules';

startServer({
  modules: [
    ...CommonNodeModules,
  ],
}).then(() => {
  console.log('ready');
  if (process.send) {
    process.send('ready');
  }
});
