import * as jest from 'jest';
import { Config } from '@jest/types';
import { argv } from '../../packages/core-common/src/node/cli';

export async function runTest(targets: string[], project?: string) {
  console.log(argv);
  const testPathPattern = targets.map((v) => `packages\/${v}\/__tests?__\/.*\\.(test|spec)\\.[jt]sx?$`);
  return await jest.runCLI(
    {
      passWithNoTests: true,
      testPathPattern,
      selectProjects: project ? [project] : undefined,
      detectOpenHandles: true,
      forceExit: true,
      ...argv,
    } as Config.Argv,
    [process.cwd()],
  );
}
