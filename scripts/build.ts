import * as path from 'path';

import chalk from 'chalk';
import { command } from 'execa';
import * as fs from 'fs-extra';
import * as glob from 'glob';

import { run } from './fn/shell';

(async () => {
  await run('yarn run clean');

  {
    const cmd = 'yarn tsc --build configs/ts/tsconfig.build.json';
    console.log(`[RUN]: ${cmd}`);
    const childProcess = command(cmd, {
      stdio: 'pipe',
      shell: true,
      //   TODO: 支持不同包使用包内安装的 tsc，避免单个包的 typescript 无法升级
    });

    const tscErrorRegex = /error TS\d+:/;

    childProcess.stdout!.on('data', (data) => {
      const str = data.toString();
      if (tscErrorRegex.test(str)) {
        process.stdout.write('\n');
        process.stdout.write(chalk.redBright(str));
        process.stdout.write('\n');

        setTimeout(() => {
          childProcess.kill('SIGINT');
          setTimeout(() => {
            process.stdout.write(chalk.red('It seems that tsc has error, so we exit.\n'));
            process.stdout.write('\n');
            process.exit(1);
          });
        }, 100);
      }
    });

    await childProcess;
  }

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
})().catch((e) => {
  console.trace(e);
  process.exit(128);
});
