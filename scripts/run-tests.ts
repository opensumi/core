// 用来 debug 某个 packages 的测试有问题
// 该模块会一个个的跑每个 package 下的测试

import { join } from 'path';

import { command } from 'execa';
import { mkdirSync, pathExistsSync, readJSONSync, readdirSync, removeSync, writeJSONSync } from 'fs-extra';

import { parseArgv } from '../packages/utils/src/argv';
import { pSeries } from '../packages/utils/src/promises';

const argv = parseArgv(process.argv.slice(2));

const packagesDir = join(__dirname, '../packages');
const cacheDir = join(__dirname, '../.tests-cache');
const packagesDirNames = readdirSync(packagesDir);

class CheckPoint {
  dirPath: string;

  constructor(private name: string, clean?: boolean) {
    this.dirPath = join(cacheDir, name);
    if (clean) {
      this.clean();
    } else {
      if (!pathExistsSync(this.dirPath)) {
        mkdirSync(this.dirPath, { recursive: true });
      }
    }
  }
  getFilePath(name: string) {
    return join(this.dirPath, name + '.json');
  }
  set(name: string, value: any) {
    writeJSONSync(this.getFilePath(name), value, {
      spaces: 2,
    });
  }
  get(name: string) {
    if (!pathExistsSync(this.getFilePath(name))) {
      return null;
    }
    return readJSONSync(this.getFilePath(name));
  }
  clean() {
    removeSync(this.dirPath);
    mkdirSync(this.dirPath, { recursive: true });
  }
}

const successCheckPoint = new CheckPoint('success');
const failCheckPoint = new CheckPoint('fail', true);

if (argv.noCache) {
  successCheckPoint.clean();
}

const skipList = ((argv as any).skipList ?? '').split(',') || ([] as string[]);
const testResult = {};

const funcs = packagesDirNames.map((target) => async () => {
  console.log('current jest module:', target);
  const result = {};
  if (skipList.includes(target)) {
    console.log(`${target} is in skip list`);
    result['status'] = 'skipped';
    testResult[target] = result;
    return;
  }

  await Promise.all(
    ['jsdom', 'node'].map((v) =>
      (async () => {
        const checkPointKey = `${target}-${v}`;
        if (successCheckPoint.get(checkPointKey)) {
          console.log(`${checkPointKey} 命中 successCheckPoint，跳过`);
          return;
        }
        const env = {};
        if ((argv as any).strictPromise) {
          env['EXIT_ON_UNHANDLED_REJECTION'] = 'true';
        }
        let cmd = `yarn test:module --module=${target} --project=${v}`;
        if ((argv as any).serial) {
          cmd += ' --no-runInBand';
        }

        console.log('cmd:', cmd, 'env:', env);
        const runResult = await command(cmd, {
          reject: false,
          stdio: 'inherit',
          shell: true,
          env,
        });
        const info = {
          info: runResult,
        };

        if (!runResult.failed) {
          successCheckPoint.set(checkPointKey, info);
          info['status'] = 'success';
        } else {
          info['status'] = 'failed';
          failCheckPoint.set(checkPointKey, info);
        }

        result[v] = info;
      })(),
    ),
  );

  console.log('end module:', target);
  testResult[target] = result;
});

pSeries(funcs).then(() => {
  writeJSONSync(join(cacheDir, 'tests.json'), testResult);
});
