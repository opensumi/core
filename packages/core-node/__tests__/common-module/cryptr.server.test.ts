import { INativeCryptrService } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { CryptrService } from '../../src/common-module/cryptr.server';

describe('test for core-browser/src/services/cryptr-service.ts', () => {
  let injector: MockInjector;
  let cryptrService: INativeCryptrService;
  const password = 'password';
  let hash;
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: INativeCryptrService,
      useClass: CryptrService,
    });
    cryptrService = injector.get<INativeCryptrService>(INativeCryptrService);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('encrypt', async () => {
    hash = await cryptrService.encrypt(password);
    expect(hash).toBeDefined();
  });

  it('decrypt', async () => {
    const pw = await cryptrService.decrypt(hash);
    expect(pw).toBe(password);
  });
});
