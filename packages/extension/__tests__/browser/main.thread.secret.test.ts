import { AppConfig, ICredentialsService, ICryptrService } from '@opensumi/ide-core-browser/src';
import { Emitter } from '@opensumi/ide-core-common';
import { MainThreadSecret } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.secret';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

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
  const mockCryptrService = {
    decrypt: jest.fn((value) => value),
    encrypt: jest.fn((value) => value),
  };
  beforeAll(() => {
    injector = createBrowserInjector(
      [],
      new MockInjector([
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
        token: ICryptrService,
        useValue: mockCryptrService,
      },
    );
    mainThreadSecret = injector.get(MainThreadSecret, [mockProxy as any]);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('$setPassword', async () => {
    await mainThreadSecret.$setPassword(extensionId, key, value);
    expect(mockCredentialsService.setPassword).toBeCalled();
    expect(mockCryptrService.encrypt).toBeCalled();
  });

  it('$getPassword', async () => {
    await mainThreadSecret.$getPassword(extensionId, key);
    expect(mockCredentialsService.getPassword).toBeCalled();
    expect(mockCryptrService.decrypt).toBeCalled();
  });

  it('$deletePassword', async () => {
    await mainThreadSecret.$deletePassword(extensionId, key);
    expect(mockCredentialsService.deletePassword).toBeCalled();
  });
});
