import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ExplorerModule } from '@ide-framework/ide-explorer';
import { ExplorerContribution } from '@ide-framework/ide-explorer/lib/browser/explorer-contribution';

describe('Explorer contribution should be work', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([
      ExplorerModule,
    ]);
  });

  describe('01 #Init', () => {
    it('should contribution work', async () => {
      const register = jest.fn();
      const contribution = injector.get(ExplorerContribution);
      contribution.registerComponent({register} as any);
      expect(register).toBeCalledTimes(1);
    });
  });

});
