import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { OutlineModule } from '../../src/browser';
import { OutlineContribution } from '../../src/browser/outline.contribution';

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
      expect(mockMainLayoutService.collectViewComponent).toHaveBeenCalledTimes(1);
    });

    it('should registerCommands be work', async () => {
      const contribution = mockInjector.get(OutlineContribution);
      const register = jest.fn();
      contribution.registerCommands({ registerCommand: register } as any);
      expect(register).toHaveBeenCalledTimes(5);
    });

    it('should registerToolbarItems be work', async () => {
      const contribution = mockInjector.get(OutlineContribution);
      const register = jest.fn();
      contribution.registerToolbarItems({ registerItem: register } as any);
      expect(register).toHaveBeenCalledTimes(5);
    });
  });
});
