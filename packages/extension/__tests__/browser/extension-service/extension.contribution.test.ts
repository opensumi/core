import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import { uuid } from '@opensumi/ide-core-common';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { getClientId } from '../../../src/browser/extension.contribution';

import { setupExtensionServiceInjector } from './extension-service-mock-helper';

describe('Extension service', () => {
  let injector: MockInjector;

  beforeAll(() => {
    injector = setupExtensionServiceInjector();
    injector.addProviders({
      token: WSChannelHandler,
      useValue: mockService({
        clientId: uuid(),
      }),
    });

    injector.get(IMainLayoutService).viewReady.resolve();
  });

  describe('Extension Contribution', () => {
    it('should generate client id.', async () => {
      const clientId = getClientId(injector);
      expect(typeof clientId).toBe('string');
    });
  });
});
