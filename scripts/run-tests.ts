import { argv } from '../packages/core-common/src/node/cli';

import { runTest } from './jest/runTest';

if ((argv as any).strictPromise) {
  process.env['EXIT_ON_UNHANDLED_REJECTION'] = 'true';
}

runTest().then((v) => {
  console.log('测试是否成功:', v.results.success);
  // 如果一秒后进程还没退出
  setTimeout(() => {
    console.log('3s 后强行退出');
    process.exit(v.results.success ? 0 : 1);
  }, 3000);
});
