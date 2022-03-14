import * as glob from 'glob';
import * as path from 'path';
import { run } from './fn/shell';
import * as fs from 'fs-extra';

(async () => {
  await run('npm run clean');
  await run('npx tsc --build configs/ts/tsconfig.build.json');

  const filePatten = '*/src/**/!(*.ts|*.tsx)';
  console.log(`[COPY]: ${filePatten}`);
  const cwd = path.join(__dirname, '../packages');
  const files = glob.sync(filePatten, { cwd, nodir: true });
  for (const file of files) {
    const from = path.join(cwd, file);
    const to = path.join(cwd, file.replace(/\/src\//, '/lib/'));
    await fs.mkdirp(path.dirname(to));
    await fs.copyFile(from, to);
  }

  const configFile = path.join(__dirname, 'test/jest.config.js');
  const testFile = path.join(__dirname, 'test/build.js');

  // // await run(`npx jest ${testFile} -c ${configFile}`);
})().catch((e) => {
  console.trace(e);
  process.exit(128);
});
