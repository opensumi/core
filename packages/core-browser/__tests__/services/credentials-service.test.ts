import { KeytarServicePath } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ICredentialsService } from '../../src';
import { CredentialsService } from '../../src/services';

describe('test for core-browser/src/services/credentials-service.ts', () => {
  let injector: MockInjector;
  let credentialsService: ICredentialsService;
  const testData = {
    service: 'test',
    account: 'test',
  };
  const mockNativeCredentialService = {
    setPassword: jest.fn(),
    getPassword: jest.fn(),
    deletePassword: jest.fn(),
    findPassword: jest.fn(),
    findCredentials: jest.fn(),
  };
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: ICredentialsService,
        useClass: CredentialsService,
      },
      {
        token: KeytarServicePath,
        useValue: mockNativeCredentialService,
      },
    );
    credentialsService = injector.get<ICredentialsService>(ICredentialsService);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('getPassword', async () => {
    await credentialsService.getPassword(testData.service, testData.account);
    expect(mockNativeCredentialService.getPassword).toBeCalledWith(testData.service, testData.account);
  });

  it('setPassword', async (done) => {
    const password = 'password';
    const disposable = credentialsService.onDidChangePassword((event) => {
      expect(event.service).toBe(testData.service);
      expect(event.account).toBe(testData.account);
      disposable.dispose();
      done();
    });
    await credentialsService.setPassword(testData.service, testData.account, password);
    expect(mockNativeCredentialService.setPassword).toBeCalledWith(testData.service, testData.account, password);
  });

  it('deletePassword', async (done) => {
    const disposable = credentialsService.onDidChangePassword((event) => {
      expect(event.service).toBe(testData.service);
      expect(event.account).toBe(testData.account);
      disposable.dispose();
      done();
    });
    await credentialsService.deletePassword(testData.service, testData.account);
    expect(mockNativeCredentialService.deletePassword).toBeCalledWith(testData.service, testData.account);
  });

  it('findPassword', async () => {
    await credentialsService.findPassword(testData.service);
    expect(mockNativeCredentialService.findPassword).toBeCalledWith(testData.service);
  });

  it('findCredentials', async () => {
    await credentialsService.findCredentials(testData.service);
    expect(mockNativeCredentialService.findCredentials).toBeCalledWith(testData.service);
  });
});
