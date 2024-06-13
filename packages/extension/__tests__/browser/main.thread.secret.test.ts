import { AppConfig, ICredentialsService, ICryptoService } from '@opensumi/ide-core-browser/src';
import { Emitter } from '@opensumi/ide-core-common';
import { createBrowserInjector, getBrowserMockInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { MainThreadSecret } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.secret';

const onDidChangePasswordEmitter = new Emitter();
const mockExtThreadSecretProxy = {
  $onDidChangePassword: onDidChangePasswordEmitter.event,
};

const mockProxy = {
  getProxy: () => mockExtThreadSecretProxy,
};

const extensionId = 'extensionId';
const key = 'key';
const value = 'value';

describe('MainThreadSecret API Test Suite', () => {
  let injector: MockInjector;
  let mainThreadSecret: MainThreadSecret;
  const onDidChangePasswordEmitter = new Emitter();
  const mockCredentialsService = {
    onDidChangePassword: onDidChangePasswordEmitter.event,
    getPassword: jest.fn(() =>
      JSON.stringify({
        extensionId,
        content: 'hello',
      }),
    ),
    setPassword: jest.fn(),
    deletePassword: jest.fn(),
  };
  const mockCryptoService = {
    decrypt: jest.fn((value) => value),
    encrypt: jest.fn((value) => value),
  };
  beforeAll(() => {
    injector = createBrowserInjector(
      [],
      getBrowserMockInjector([
        {
          token: AppConfig,
          useValue: {
            uriScheme: 'uriScheme',
          },
        },
      ]),
    );
    injector.overrideProviders(
      {
        token: ICredentialsService,
        useValue: mockCredentialsService,
      },
      {
        token: ICryptoService,
        useValue: mockCryptoService,
      },
    );
    mainThreadSecret = injector.get(MainThreadSecret, [mockProxy as any]);
  });

  afterAll(async () => {
    await injector.disposeAll();
  });

  it('$setPassword', async () => {
    await mainThreadSecret.$setPassword(extensionId, key, value);
    expect(mockCredentialsService.setPassword).toHaveBeenCalled();
    expect(mockCryptoService.encrypt).toHaveBeenCalled();
  });

  it('$getPassword', async () => {
    await mainThreadSecret.$getPassword(extensionId, key);
    expect(mockCredentialsService.getPassword).toHaveBeenCalled();
    expect(mockCryptoService.decrypt).toHaveBeenCalled();
  });

  it('$deletePassword', async () => {
    await mainThreadSecret.$deletePassword(extensionId, key);
    expect(mockCredentialsService.deletePassword).toHaveBeenCalled();
  });
});
