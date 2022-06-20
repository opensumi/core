import * as jest from 'jest';
import { Config } from '@jest/types';
import { argv } from '../../packages/core-common/src/node/cli';

export async function runTest(targets: string[], projects?: string[], config?: Config.Argv) {
  console.log('test argv', argv);
  const testPathPattern = targets.map((v) => `packages\/${v}\/__tests?__\/.*\\.(test|spec)\\.[jt]sx?$`);

  return await jest.runCLI(
    {
      passWithNoTests: true,
      testPathPattern,
      selectProjects: projects,
      detectOpenHandles: true,
      forceExit: true,
      ...config,
      ...argv,
    } as Config.Argv,
    [process.cwd()],
  );
}
