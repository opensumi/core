import { Config } from '@jest/types';
import * as jest from 'jest';

import { argv } from '../../packages/core-common/src/node/cli';

export async function runTest(target: string, options: { project?: string; runInBand?: boolean } = {}) {
  const { project, runInBand } = options;
  return await jest.runCLI(
    {
      runInBand,
      bail: true,
      passWithNoTests: true,
      testPathPattern: [`packages\/${target}\/__tests?__\/.*\\.(test|spec)\\.[jt]sx?$`],
      selectProjects: project ? [project] : undefined,
      detectOpenHandles: true,
      forceExit: true,
      ...argv,
    } as unknown as Config.Argv,
    [process.cwd()],
  );
}
