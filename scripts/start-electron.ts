import path from 'path';

import fse from 'fs-extra';

import { startFromFolder } from './fn/module';
import { run } from './fn/shell';

const folderName = 'tools/electron';

async function main() {
  const semaphore = path.resolve(folderName, 'node_modules/.init-done');

  if (!fse.existsSync(semaphore)) {
    await fse.remove(path.resolve(folderName, 'node_modules'));
    await run('cd tools/electron && yarn && yarn run link-local && yarn run rebuild-native && yarn run build');
    fse.closeSync(fse.openSync(semaphore, 'a'));
  }

  startFromFolder(folderName, 'start');
}

main();
