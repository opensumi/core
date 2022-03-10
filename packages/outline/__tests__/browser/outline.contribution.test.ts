import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { OutlineModule } from '@opensumi/ide-outline/lib/browser';
import { OutlineContribution } from '@opensumi/ide-outline/lib/browser/outline.contribution';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('Outline contribution should be work', () => {
  let mockInjector: MockInjector;
  const mockMainLayoutService = {
    collectViewComponent: jest.fn(),
  } as any;

  beforeEach(() => {
    mockInjector = createBrowserInjector([OutlineModule]);

    mockInjector.overrideProviders({
      token: IMainLayoutService,
      useValue: mockMainLayoutService,
    });
  });

  describe('01 #contribution should be work', () => {
    it('should onDidRender be work', async () => {
      const contribution = mockInjector.get(OutlineContribution);
      contribution.onDidRender();
      expect(mockMainLayoutService.collectViewComponent).toBeCalledTimes(1);
    });

    it('should registerCommands be work', async () => {
      const contribution = mockInjector.get(OutlineContribution);
      const register = jest.fn();
      contribution.registerCommands({ registerCommand: register } as any);
      expect(register).toBeCalledTimes(5);
    });

    it('should registerToolbarItems be work', async () => {
      const contribution = mockInjector.get(OutlineContribution);
      const register = jest.fn();
      contribution.registerToolbarItems({ registerItem: register } as any);
      expect(register).toBeCalledTimes(5);
    });
  });
});
