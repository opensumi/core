import { INativeCryptoService } from '@opensumi/ide-core-common';

import { MockInjector, createNodeInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { CryptoService } from '../../src/common-module/crypto.server';

describe('test for core-browser/src/services/crypto-service.ts', () => {
  let injector: MockInjector;
  let cryptoService: INativeCryptoService;
  const password = 'password';
  let hash;
  beforeAll(() => {
    injector = createNodeInjector([]);
    injector.addProviders({
      token: INativeCryptoService,
      useClass: CryptoService,
    });
    cryptoService = injector.get<INativeCryptoService>(INativeCryptoService);
  });

  afterAll(() => {
    return injector.disposeAll();
  });
  it('encrypt', async () => {
    hash = await cryptoService.encrypt(password);
    expect(hash).toBeDefined();
  });

  it('decrypt', async () => {
    const pw = await cryptoService.decrypt(hash);
    expect(pw).toBe(password);
  });
});
