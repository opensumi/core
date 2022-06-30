import { argv } from '../packages/core-common/src/node/cli';

import { runTest } from './jest/runTest';

const modulePath: string | undefined = argv.module as any;

if (!modulePath) {
  throw new Error('必须使用 --module 参数 提供Module名称， 例子： npm run test:module -- --module=editor');
}

runTest(modulePath, argv.project as string).then((v) => {
  console.log('测试是否成功:', v.results.success);
  // 如果三秒后进程还没退出
  setTimeout(() => {
    process.exit(v.results.success ? 0 : 1);
  }, 3000);
});
