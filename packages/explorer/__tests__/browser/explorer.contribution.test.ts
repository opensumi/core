import { ExplorerModule } from '@opensumi/ide-explorer';
import { ExplorerContribution } from '@opensumi/ide-explorer/lib/browser/explorer-contribution';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('Explorer contribution should be work', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([ExplorerModule]);
  });

  describe('01 #Init', () => {
    it('should contribution work', async () => {
      const register = jest.fn();
      const contribution = injector.get(ExplorerContribution);
      contribution.registerComponent({ register } as any);
      expect(register).toBeCalledTimes(1);
    });
  });
});
