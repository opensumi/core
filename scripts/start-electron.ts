import { startFromFolder } from './fn/module';
const folderName = 'packages/startup';

if (!folderName) {
  throw Error('folderName is required.');
}

startFromFolder(folderName, 'start:electron');
