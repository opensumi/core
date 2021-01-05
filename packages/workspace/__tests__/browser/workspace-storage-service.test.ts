import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IWorkspaceService, IWorkspaceStorageService } from '@ali/ide-workspace';
import { URI } from '@ali/ide-core-common';
import { WorkspaceModule } from '../../src/browser';
import { FileStat } from '@ali/ide-file-service';
import { GlobalBrowserStorageService } from '@ali/ide-core-browser/lib/services';

describe('WorkspaceStorageService should be work', () => {
  let workspaceStorageService: IWorkspaceStorageService;
  const workspaceUri = new URI('file://userhome/');
  const workspaceRoot = {
    uri: workspaceUri.toString(),
    lastModification: new Date().getTime(),
    isDirectory: true,
  } as FileStat;
  let injector: MockInjector;
  const mockWorkspaceService = {
    roots: Promise.resolve([workspaceRoot]),
    workspace: workspaceRoot,
    onWorkspaceLocationChanged: jest.fn(),
  };
  const mockLocalStorageService = {
    setData: jest.fn(),
    getData: jest.fn(),
  };
  beforeEach(async (done) => {
    injector = createBrowserInjector([
      WorkspaceModule,
    ]);
    injector.overrideProviders({
      token: GlobalBrowserStorageService,
      useValue: mockLocalStorageService,
    });
    injector.overrideProviders({
      token: IWorkspaceService,
      useValue: mockWorkspaceService,
    });

    workspaceStorageService = injector.get(IWorkspaceStorageService);
    done();
  });

  afterEach(() => {
    injector.disposeAll();
    mockWorkspaceService.onWorkspaceLocationChanged.mockReset();
    mockLocalStorageService.getData.mockReset();
    mockLocalStorageService.setData.mockReset();
  });

  it('should have enough API', async (done) => {
    expect(mockWorkspaceService.onWorkspaceLocationChanged).toBeCalled();
    done();
  });

  it('setData method should be work', async (done) => {
    await workspaceStorageService.setData('hello', 'world');
    expect(mockLocalStorageService.setData).toBeCalledWith(`${workspaceUri.toString()}:hello`, 'world');
    done();
  });

  it('getData method should be work', async (done) => {
    await workspaceStorageService.getData('hello', 'world');
    expect(mockLocalStorageService.getData).toBeCalledWith(`${workspaceUri.toString()}:hello`, 'world');
    done();
  });
});
