import { AppConfig } from '@opensumi/ide-core-browser';
import { ExtensionStorageService } from '@opensumi/ide-extension-storage/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IExtensionStorageService, IExtensionStorageServer } from '../../src/common';

describe('ExtensionStorage service should be work', () => {
  let injector: MockInjector;
  let extensionStorageService: IExtensionStorageService;
  let mockInit;
  beforeAll(async () => {
    injector = createBrowserInjector([]);

    // mock used instance
    injector.overrideProviders(
      {
        token: IExtensionStorageServer,
        useValue: {
          get: jest.fn(() => undefined),
        },
      },
      {
        token: AppConfig,
        useValue: {},
      },
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: IExtensionStorageService,
        useClass: ExtensionStorageService,
      },
    );
    mockInit = jest.fn();
    extensionStorageService = injector.get(IExtensionStorageService);
    injector.mock(IExtensionStorageServer, 'init', mockInit);
    await extensionStorageService.whenReady;
  });

  afterAll(async () => {
    await injector.disposeAll();
  });

  it('01 #Init', async () => {
    expect(mockInit).toBeCalledTimes(1);
  });

  it('02 #Set', async () => {
    const mockSet = jest.fn();
    const key = 'key';
    const value = { hello: 'world' };
    const isGlobal = false;
    injector.mock(IExtensionStorageServer, 'set', mockSet);
    extensionStorageService.set(key, value, isGlobal);
    expect(mockSet).toBeCalledWith(key, value, isGlobal);
  });

  it('03 #Get', async () => {
    const mockGet = jest.fn();
    const key = 'key';
    const isGlobal = false;
    injector.mock(IExtensionStorageServer, 'get', mockGet);
    await extensionStorageService.get(key, isGlobal);
    expect(mockGet).toBeCalledWith(key, isGlobal);
  });

  it('04 #GetAll', async () => {
    const mockGetAll = jest.fn();
    const isGlobal = false;
    injector.mock(IExtensionStorageServer, 'getAll', mockGetAll);
    await extensionStorageService.getAll(isGlobal);
    expect(mockGetAll).toBeCalledWith(isGlobal);
  });

  it('05 #ReConnectInit', async () => {
    await extensionStorageService.reConnectInit();
    expect(mockInit).toBeCalledTimes(2);
  });
});
