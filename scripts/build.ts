import * as glob from 'glob';
import * as path from 'path';
import { run } from './fn/shell';
import * as fs from 'fs-extra';

(async () => {
  await run('yarn run clean');
  await run('yarn tsc --build configs/ts/tsconfig.build.json');

  const filePatten = '*/src/**/!(*.ts|*.tsx)';
  console.log(`[COPY]: ${filePatten}`);
  // 拷贝非 ts/js 文件
  const cwd = path.join(__dirname, '../packages');
  const files = glob.sync(filePatten, { cwd, nodir: true });
  for (const file of files) {
    const from = path.join(cwd, file);
    const to = path.join(cwd, file.replace(/\/src\//, '/lib/'));
    await fs.mkdirp(path.dirname(to));
    await fs.copyFile(from, to);
  }
  await run('yarn workspace @opensumi/sumi build');
})().catch((e) => {
  console.trace(e);
  process.exit(128);
});
