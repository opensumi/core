import { argv } from '../packages/core-common/src/node/cli';

import { runTest } from './jest/runTest';

const modulePath: string | undefined = argv.module as any;

if (!modulePath) {
  console.error(
    'The module name must be provided using the `--module={folder}` parameter, eg: yarn run test:module --module=editor',
  );
  process.exit(1);
}

runTest(modulePath, argv.project as string).then((v) => {
  console.log('Test Result:', v.results.success ? 'PASS' : 'FAIL');
  // 如果三秒后进程还没退出
  setTimeout(() => {
    process.exit(v.results.success ? 0 : 1);
  }, 3000);
});
