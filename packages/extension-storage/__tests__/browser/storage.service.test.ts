import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IExtensionStorageService, IExtensionStorageServer } from '../../src/common';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { AppConfig } from '@opensumi/ide-core-browser';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';
import { ExtensionStorageService } from '@opensumi/ide-extension-storage/lib/browser';

describe('ExtensionStorage service should be work', () => {
  let injector: MockInjector;
  let extensionStorageService: IExtensionStorageService;
  let mockInit;
  beforeEach(async () => {
    injector = createBrowserInjector([]);

    // mock used instance
    injector.overrideProviders(
      {
        token: IExtensionStorageServer,
        useValue: {} ,
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

  afterEach(async () => {
    injector.disposeAll();
  });

  it('01 #Init', async (done) => {
    expect(mockInit).toBeCalledTimes(1);
    done();
  });

  it('02 #Set', async (done) => {
    const mockSet = jest.fn();
    const key = 'key';
    const value =  {hello: 'world'};
    const isGlobal = false;
    injector.mock(IExtensionStorageServer, 'set', mockSet);
    extensionStorageService.set(key, value, isGlobal);
    expect(mockSet).toBeCalledWith(key, value, isGlobal);
    done();
  });

  it('03 #Get', async (done) => {
    const mockGet = jest.fn();
    const key = 'key';
    const isGlobal = false;
    injector.mock(IExtensionStorageServer, 'get', mockGet);
    await extensionStorageService.get(key, isGlobal);
    expect(mockGet).toBeCalledWith(key, isGlobal);
    done();
  });

  it('04 #GetAll', async (done) => {
    const mockGetAll = jest.fn();
    const isGlobal = false;
    injector.mock(IExtensionStorageServer, 'getAll', mockGetAll);
    await extensionStorageService.getAll(isGlobal);
    expect(mockGetAll).toBeCalledWith(isGlobal);
    done();
  });

  it('05 #ReConnectInit', async (done) => {
    await extensionStorageService.reConnectInit();
    expect(mockInit).toBeCalledTimes(2);
    done();
  });
});
