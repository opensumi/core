import { argv } from '../packages/core-common/src/node/cli';
import { startFromFolder } from './fn/module';

const folderName = (argv.folder as string) || 'packages/umi-app';
const scriptName = (argv.script as string) || 'dev';

if (!folderName) {
  throw Error('folderName is required.');
}

startFromFolder(folderName, scriptName);
