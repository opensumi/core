import { startServer } from './server';
import { CommonNodeModules } from '../../common/node';

startServer({
  modules: [
    ...CommonNodeModules,
  ],
}).then(() => {
  if (process.send) {
    process.send('ready');
  }
});
