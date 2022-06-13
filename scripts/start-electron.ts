import fs from 'fs';
import path from 'path';
import { startFromFolder } from './fn/module';
import { run } from './fn/shell';

const folderName = 'tools/electron';

async function main() {
  const semphore = path.resolve(folderName, 'node_modules/.init-done');
  if (!fs.existsSync(semphore)) {
    await run(
      'cd tools/electron && rimraf ./node_modules && npm i && npm run link-local && npm run rebuild-native && npm run build',
    );
    await run('touch ' + semphore);
  }

  startFromFolder(folderName, 'start');
}

main();
