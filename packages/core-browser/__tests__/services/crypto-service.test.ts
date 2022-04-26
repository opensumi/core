import { CryptoServicePath } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { CryptoService, ICryptoService } from '../../src';

describe('test for core-browser/src/services/crypto-service.ts', () => {
  let injector: MockInjector;
  let cryptoService: ICryptoService;
  const password = 'password';
  const hash = 'hash';
  const mockCryptoService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: ICryptoService,
        useClass: CryptoService,
      },
      {
        token: CryptoServicePath,
        useValue: mockCryptoService,
      },
    );
    cryptoService = injector.get<ICryptoService>(ICryptoService);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('encrypt', async () => {
    await cryptoService.encrypt(password);
    expect(mockCryptoService.encrypt).toBeCalledWith(password);
  });

  it('decrypt', async () => {
    await cryptoService.decrypt(hash);
    expect(mockCryptoService.decrypt).toBeCalledWith(hash);
  });
});
