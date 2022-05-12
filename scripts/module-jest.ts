import { argv } from 'yargs';
import { runTest } from './jest/runTest';

const modulePath: string | undefined = argv.module as any;

if (!modulePath) {
  throw new Error('必须使用 --module 参数 提供Module名称， 例子： npm run test:module -- --module=editor');
}

runTest(modulePath, argv.project as string).then(console.log.bind(console));
