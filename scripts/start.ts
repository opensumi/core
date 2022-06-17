import { startFromFolder } from './fn/module';
import { argv } from '../packages/core-common/src/node/cli';

const folderName = (argv.folder as string) || 'packages/startup';
const scriptName = (argv.script as string) || 'start';

if (!folderName) {
  throw Error('folderName is required.');
}

startFromFolder(folderName, scriptName);
