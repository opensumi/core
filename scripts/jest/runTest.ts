import * as jest from 'jest';

export async function runTest(target: string, project?: string) {
  return await jest.runCLI(
    {
      runInBand: true,
      json: true,
      passWithNoTests: true,
      testPathPattern: [`packages/${target}(/__tests?__/.*|(\\.|/)(test|spec))\\.[jt]sx?$`],
      selectProjects: project ? [project] : undefined,
    } as any,
    [__dirname],
  );
}
