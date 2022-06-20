import { argv } from '../packages/core-common/src/node/cli';
import { runTest } from './jest/runTest';

import { getShardPackages } from './jest/shard';

let pkgs = getShardPackages();

const packagesDirNames = pkgs.map((pkg) => pkg.dirname);

const main = async () => {
  console.log(`current jest modules:`, packagesDirNames);
  const env = {};
  if ((argv as any).strictPromise) {
    env['EXIT_ON_UNHANDLED_REJECTION'] = 'true';
  }

  const v = await runTest(packagesDirNames);
  console.log('测试是否成功:', v.results.success);
  // 如果一秒后进程还没退出
  setTimeout(() => {
    console.log('1s 后强行退出');
    process.exit(v.results.success ? 0 : 1);
  }, 1000);
};

main();
