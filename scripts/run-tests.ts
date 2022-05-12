// 用来 debug 某个 packages 的测试有问题
// 该模块会一个个的跑每个 package 下的测试

import { join } from 'path';
import yargs from 'yargs';

import { shell } from 'execa';
import { readdirSync, writeJSONSync, mkdirSync, readJSONSync, pathExistsSync, removeSync } from 'fs-extra';

const argv = yargs.argv;

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

/*
 * serial executes Promises sequentially.
 * @param {funcs} An array of funcs that return promises.
 * @example
 * const urls = ['/url1', '/url2', '/url3']
 * serial(urls.map(url => () => $.ajax(url)))
 *     .then(console.log.bind(console))
 */
const serial = (funcs) =>
  funcs.reduce(
    (promise, func) => promise.then((result) => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]),
  );

const skipList = ((argv as any).skipList ?? '').split(',') || ([] as string[]);
const testResult = {};

const funcs = packagesDirNames.map((target) => {
  return async () => {
    console.log(`current jest module:`, target);
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
          const cmd = `yarn test:module --module=${target} --project=${v} --no-runInBand`;
          console.log('cmd:', cmd);
          const runResult = await shell(cmd, {
            reject: false,
            stdio: 'inherit',
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

    console.log(`end module:`, target);
    testResult[target] = result;
  };
});

serial(funcs).then(() => {
  writeJSONSync(join(cacheDir, 'tests.json'), testResult);
});
