import { INativeCredentialService, isLinux } from '@opensumi/ide-core-common';
import { AppConfig } from '@opensumi/ide-core-node';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { CredentialService } from '../../src/common-module/credential.server';

describe('test for core-browser/src/services/credentials-service.ts', () => {
  let injector: MockInjector;
  let credentialsService: INativeCredentialService;
  const testData = {
    service: 'test',
    account: 'test',
  };
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: AppConfig,
        useValue: {},
      },
      {
        token: INativeCredentialService,
        useClass: CredentialService,
      },
    );
    credentialsService = injector.get<INativeCredentialService>(INativeCredentialService);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  (isLinux ? it.skip : it)('setPassword', async () => {
    const password = 'password';
    await credentialsService.setPassword(testData.service, testData.account, password);
  });

  (isLinux ? it.skip : it)('getPassword', async () => {
    const pw = await credentialsService.getPassword(testData.service, testData.account);
    expect(pw).toBeDefined();
  });

  (isLinux ? it.skip : it)('findPassword', async () => {
    const found = await credentialsService.findPassword(testData.service);
    expect(found).toBeDefined();
  });

  (isLinux ? it.skip : it)('findCredentials', async () => {
    const crds = await credentialsService.findCredentials(testData.service);
    expect(Array.isArray(crds)).toBeTruthy();
  });

  (isLinux ? it.skip : it)('deletePassword', async () => {
    const deleted = await credentialsService.deletePassword(testData.service, testData.account);
    expect(deleted).toBeTruthy();
  });
});
