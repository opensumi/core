// 用来 debug 某个 packages 的测试有问题
// 该模块会一个个的跑每个 package 下的测试

import { join } from 'path';

import { command } from 'execa';
import { writeJSONSync, mkdirSync, readJSONSync, pathExistsSync, removeSync } from 'fs-extra';

import { argv } from '../../packages/core-common/src/node/cli';
import { pLimit } from '../../packages/utils/src/promises';

import { getShardPackages } from '../jest/shard';
import { runTest } from './runTest';

const cacheDir = join(__dirname, '../.tests-cache');

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

const pkgs = getShardPackages();

if (argv.noCache) {
  successCheckPoint.clean();
}

const packagesDirNames = pkgs.map((pkg) => pkg.dirname);

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
    const checkPointKey = `${target}`;
    if (successCheckPoint.get(checkPointKey)) {
      console.log(`${checkPointKey} 命中 successCheckPoint，跳过`);
      return;
    }

    if ((argv as any).strictPromise) {
      process.env['EXIT_ON_UNHANDLED_REJECTION'] = 'true';
    }

    const runResult = await runTest([target], undefined, {
      runInBand: true,
      bail: true,
      ...argv,
    });

    const info = {
      info: runResult,
    };

    if (!runResult.results.success) {
      successCheckPoint.set(checkPointKey, info);
      info['status'] = 'success';
    } else {
      info['status'] = 'failed';
      failCheckPoint.set(checkPointKey, info);
    }
    result['info'] = info;

    console.log(`end module:`, target);
    testResult[target] = result;
  };
});

pLimit(funcs, 6).then(() => {
  writeJSONSync(join(cacheDir, 'tests.json'), testResult);
});
