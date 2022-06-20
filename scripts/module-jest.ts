import { argv } from '../packages/core-common/src/node/cli';

import { runTest } from './jest/runTest';

const modulePath: string | undefined = argv.module as any;

console.log('Example:');
console.log('npm run test:module -- --module=editor,core-common');
console.log('npm run test:module -- --module=editor,core-common --project node,jsdom');

if (!modulePath) {
  throw new Error(
    '必须使用 --module 参数 提供Module名称， 例子：npm run test:module -- --module=editor\nnpm run test:module -- --module=editor,core-common',
  );
}

let selectProjects: string[] | undefined = undefined;

if (argv.project) {
  selectProjects = (argv.project as string).split(',');
}

const targets = modulePath.split(',');

runTest(targets, selectProjects).then((v) => {
  console.log('测试是否成功:', v.results.success);
  // 如果三秒后进程还没退出
  setTimeout(() => {
    process.exit(v.results.success ? 0 : 1);
  }, 3000);
});
