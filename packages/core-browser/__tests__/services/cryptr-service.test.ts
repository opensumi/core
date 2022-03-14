import { CryptrServicePath } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { CryptrService, ICryptrService } from '../../src';

describe('test for core-browser/src/services/cryptr-service.ts', () => {
  let injector: MockInjector;
  let cryptrService: ICryptrService;
  const password = 'password';
  const hash = 'hash';
  const mockCryptrService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: ICryptrService,
        useClass: CryptrService,
      },
      {
        token: CryptrServicePath,
        useValue: mockCryptrService,
      },
    );
    cryptrService = injector.get<ICryptrService>(ICryptrService);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('encrypt', async () => {
    await cryptrService.encrypt(password);
    expect(mockCryptrService.encrypt).toBeCalledWith(password);
  });

  it('decrypt', async () => {
    await cryptrService.decrypt(hash);
    expect(mockCryptrService.decrypt).toBeCalledWith(hash);
  });
});
