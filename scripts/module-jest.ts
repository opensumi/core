import { argv } from 'yargs';
import * as jest from 'jest';

const target: string | undefined = argv.module as any;

if (!target) {
  throw new Error('必须使用 --module参数 提供Module名称， 例子： npm run test:module -- --module=editor');
}

jest.run(['--testPathPattern', `packages/${target}(/__tests?__/.*|(\\.|/)(test|spec))\\.[jt]sx?$`]);
