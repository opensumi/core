import { IDebugService } from '@opensumi/ide-debug';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { DebugService } from '@opensumi/ide-debug/lib/browser/debug-service';

describe('DebugService', () => {
  let debugService: IDebugService;
  let injector: MockInjector;

  beforeAll(() => {
    injector = createBrowserInjector([], new MockInjector([
      {
        token: IDebugService,
        useClass: DebugService,
      },
    ]));
    debugService = injector.get(IDebugService);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('registerDebugContributionPoints should emit change', (done) => {
    debugService.onDidDebugContributionPointChange(() => {
      done();
    });

    debugService.registerDebugContributionPoints('file://extensions/a', [{
      title: 'node',
    }]);
  });

  it('registerDebugContributionPoints should emit change', () => {
    expect(debugService.debugContributionPoints.size).toBe(1);

    debugService.unregisterDebugContributionPoints('file://extensions/a');

    expect(debugService.debugContributionPoints.size).toBe(0);
  });

});
