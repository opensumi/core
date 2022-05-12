import * as jest from 'jest';
import { Config } from '@jest/types';
import { argv } from 'yargs';

export async function runTest(target: string, project?: string) {
  return await jest.runCLI(
    {
      ...argv,
      runInBand: true,
      bail: true,
      passWithNoTests: true,
      testPathPattern: [`packages\/${target}\/__tests?__\/.*\\.(test|spec)\\.[jt]sx?$`],
      selectProjects: project ? [project] : undefined,
      detectOpenHandles: true,
      forceExit: true,
    } as Config.Argv,
    [process.cwd()],
  );
}
