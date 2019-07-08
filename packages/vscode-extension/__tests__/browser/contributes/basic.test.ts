import { VscodeContributionPoint, Contributes } from '@ali/ide-vscode-extension/lib/browser/contributes/common';
import { VscodeContributesRunner } from '@ali/ide-vscode-extension/lib/browser/contributes';
import { Injectable } from '@ali/common-di';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';

describe('vscode extension contribution basic test', () => {

  const injector = createBrowserInjector([]);

  const packageJSON = {
    contributes: {
      test: {
        'testData': '1',
      },
    },
  };

  it('should be able to load contribution points', async () => {

    VscodeContributesRunner.ContributionPoints = [
      TestContributionPoint,
    ];

    const runner = injector.get(VscodeContributesRunner, [packageJSON.contributes as any]);

    await runner.run();

    expect(TestContributionPoint.contributed).not.toBeNull();
    expect(TestContributionPoint.contributed.testData).toEqual('1');

    await runner.dispose();

    expect(TestContributionPoint.contributed).toBeNull();

  });

  it('should be able to ignore undefined contribution points', async () => {

    VscodeContributesRunner.ContributionPoints = [
      Test2ContributionPoint,
    ];

    const runner = injector.get(VscodeContributesRunner, [packageJSON.contributes as any]);

    await runner.run();

    expect(Test2ContributionPoint.initCount).toEqual(0);

  });

});

@Injectable()
@Contributes('test')
export class TestContributionPoint extends VscodeContributionPoint {

  static contributed: any = null;

  contribute() {
    TestContributionPoint.contributed = this.json;
  }

  dispose() {
    TestContributionPoint.contributed = null;
  }

}

@Injectable()
@Contributes('test2')
export class Test2ContributionPoint extends VscodeContributionPoint {

  static initCount = 0;

  contribute() {
    Test2ContributionPoint.initCount ++;
  }

}
