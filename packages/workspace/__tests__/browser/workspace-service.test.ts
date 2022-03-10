import { PreferenceService, FILES_DEFAULTS, IClientApp, IWindowService } from '@opensumi/ide-core-browser';
import { MockLoggerManageClient } from '@opensumi/ide-core-browser/__mocks__/logger';
import { MockedStorageProvider } from '@opensumi/ide-core-browser/__mocks__/storage';
import { URI, StorageProvider, Disposable, ILoggerManagerClient } from '@opensumi/ide-core-common';
import { FileStat, DiskFileServicePath } from '@opensumi/ide-file-service';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { MockFsProvider } from '@opensumi/ide-file-service/lib/common/mocks';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceService } from '@opensumi/ide-workspace/lib/browser/workspace-service';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { WorkspaceModule } from '../../src/browser';
import { WorkspacePreferences } from '../../src/browser/workspace-preferences';


describe('WorkspaceService should be work while workspace was a single directory', () => {
  let workspaceService: WorkspaceService;
  let injector: MockInjector;
  const workspaceUri = new URI('file://userhome/');
  const workspaceStat = {
    uri: workspaceUri.toString(),
    lastModification: new Date().getTime(),
    isDirectory: true,
  } as FileStat;
  const mockFileSystem = {
    onFilesChanged: jest.fn(() => Disposable.create(() => {})),
    watchFileChanges: jest.fn(() => ({
      dispose: () => {},
    })),
    setWatchFileExcludes: jest.fn(),
    setFilesExcludes: jest.fn(),
    getFileStat: jest.fn(
      (uriStr) =>
        ({
          uri: uriStr,
          lastModification: new Date().getTime(),
          isDirectory: true,
        } as FileStat),
    ),
    exists: jest.fn(() => true),
    getCurrentUserHome: jest.fn(() => workspaceStat),
    setContent: jest.fn((stat) => stat),
    resolveContent: jest.fn(),
    createFile: jest.fn(),
    access: (...args) => true,
  };
  const mockPreferenceService = {
    onPreferenceChanged: jest.fn(() => Disposable.create(() => {})),
    get: (preferenceName: string) => {
      if (preferenceName === 'files.watcherExclude') {
        return FILES_DEFAULTS.filesWatcherExclude;
      } else if (preferenceName === 'files.exclude') {
        return FILES_DEFAULTS.filesExclude;
      }
    },
    inspect: jest.fn(),
  };
  const mockWorkspacePreferences = {
    onPreferenceChanged: jest.fn(() => Disposable.create(() => {})),
    'workspace.supportMultiRootWorkspace': true,
  };
  let mockStorage = {};
  const mockRecentStorage = {
    get: jest.fn((name) => mockStorage[name] || []),
    set: jest.fn((name, value) => {
      mockStorage[name] = value;
    }),
  };
  const mockClientApp = {
    fireOnReload: jest.fn(),
  };
  const mockWindowService = {
    openNewWindow: jest.fn(),
  };
  beforeEach(async (done) => {
    injector = createBrowserInjector([WorkspaceModule]);

    injector.overrideProviders(
      {
        token: PreferenceService,
        useValue: mockPreferenceService,
      },
      {
        token: IFileServiceClient,
        useValue: mockFileSystem,
      },
      {
        token: DiskFileServicePath,
        useClass: MockFsProvider,
      },
      {
        token: StorageProvider,
        useValue: MockedStorageProvider,
      },
      {
        token: WorkspacePreferences,
        useValue: mockWorkspacePreferences,
      },
      {
        token: IClientApp,
        useValue: mockClientApp,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
      {
        token: IWindowService,
        useValue: mockWindowService,
      },
    );
    mockFileSystem.watchFileChanges.mockResolvedValue({ dispose: () => {} } as never);
    workspaceService = injector.get(IWorkspaceService);
    workspaceService.init();
    await workspaceService.whenReady;
    done();
  });

  afterEach(() => {
    mockFileSystem.onFilesChanged.mockReset();
    mockFileSystem.watchFileChanges.mockReset();
    mockFileSystem.setWatchFileExcludes.mockReset();
    mockFileSystem.setFilesExcludes.mockReset();
    mockFileSystem.getFileStat.mockReset();
    mockFileSystem.getCurrentUserHome.mockReset();
    mockFileSystem.setContent.mockReset();
    mockFileSystem.exists.mockReset();
    mockFileSystem.createFile.mockReset();
    mockFileSystem.resolveContent.mockReset();
    mockPreferenceService.onPreferenceChanged.mockClear();
    mockRecentStorage.get.mockReset();
    mockRecentStorage.set.mockReset();
    mockClientApp.fireOnReload.mockReset();
    mockWindowService.openNewWindow.mockReset();
    mockStorage = {};
    injector.disposeOne(IWorkspaceService);
  });

  it('should have enough API', () => {
    expect(workspaceService.workspace).toBeUndefined();
    expect(workspaceService.opened).toBeFalsy();
    expect(workspaceService.isMultiRootWorkspaceEnabled).toBeFalsy();
    expect(workspaceService.isMultiRootWorkspaceOpened).toBeFalsy();
  });

  it('tryGetRoots method should be work', () => {
    expect(workspaceService.tryGetRoots()).toBeDefined();
  });

  it('event method should be exist', () => {
    expect(workspaceService.onWorkspaceChanged).toBeDefined();
    expect(workspaceService.onWorkspaceLocationChanged).toBeDefined();
  });

  it('getMostRecentlyUsedWorkspace/setMostRecentlyUsedWorkspace method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.parent.resolve('new_folder');
    await workspaceService.setMostRecentlyUsedWorkspace(newWorkspaceUri.toString());
    const recent = await workspaceService.getMostRecentlyUsedWorkspace();
    expect(recent).toBe(newWorkspaceUri.toString());
    done();
  });

  it('getMostRecentlyUsedCommands/setMostRecentlyUsedCommand method should be work', async (done) => {
    const command = 'command';
    await workspaceService.setMostRecentlyUsedCommand(command);
    const recent = await workspaceService.getMostRecentlyUsedCommands();
    expect(recent).toStrictEqual([command]);
    done();
  });

  it('open method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.parent.resolve('new_folder');
    mockFileSystem.getFileStat.mockResolvedValue({
      uri: newWorkspaceUri.toString(),
      isDirectory: true,
      lastModification: new Date().getTime(),
    } as never);
    await workspaceService.open(newWorkspaceUri, { preserveWindow: true });
    expect(mockClientApp.fireOnReload).toBeCalledWith(true);
    await workspaceService.open(newWorkspaceUri);
    expect(mockWindowService.openNewWindow).toBeCalledTimes(1);
    done();
  });

  it('addRoot method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.resolve('new_folder');
    // re-set _workspace cause the workspace would be undefined in some cases
    injector.mock(IWorkspaceService, '_workspace', {
      uri: workspaceUri.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    } as FileStat);
    mockFileSystem.getCurrentUserHome.mockResolvedValue({
      uri: workspaceUri.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    } as never);
    mockFileSystem.getFileStat.mockImplementation(
      (uriStr) =>
        ({
          uri: uriStr,
          lastModification: new Date().getTime(),
          isDirectory: true,
        } as FileStat),
    );
    mockFileSystem.resolveContent.mockResolvedValue({
      stat: {},
      content: JSON.stringify({
        folders: [],
        settings: {},
      }),
    });
    mockFileSystem.setContent.mockImplementation((stat) => stat);
    await workspaceService.addRoot(newWorkspaceUri);
    expect(mockFileSystem.setContent).toBeCalledTimes(2);
    done();
  });

  it('removeRoots method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.resolve('new_folder');
    injector.mock(
      IFileServiceClient,
      'exists',
      jest.fn(() => true),
    );
    // re-set _workspace cause the workspace would be undefined in some cases
    injector.mock(IWorkspaceService, '_workspace', {
      uri: workspaceUri.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    } as FileStat);
    mockFileSystem.resolveContent.mockResolvedValue({
      stat: {},
      content: JSON.stringify({
        folders: [workspaceUri.toString()],
        settings: {},
      }),
    });
    await workspaceService.removeRoots([newWorkspaceUri]);
    expect(mockFileSystem.setContent).toBeCalledTimes(1);
    done();
  });

  it('containsSome method should be work', async (done) => {
    injector.mock(IWorkspaceService, '_roots', [workspaceStat]);
    injector.mock(IWorkspaceService, 'opened', true);
    mockFileSystem.exists.mockResolvedValue(true as never);
    const result = await workspaceService.containsSome(['test.js']);
    // always return true
    expect(result).toBeTruthy();
    done();
  });

  it('getWorkspaceRootUri method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.resolve('new_folder');
    injector.mock(IWorkspaceService, '_roots', [workspaceStat]);
    const result = workspaceService.getWorkspaceRootUri(newWorkspaceUri);
    expect(result?.toString()).toBe(workspaceUri.toString());
    done();
  });

  it('asRelativePath method should be work', async (done) => {
    // file://authority/path 为 unc path 其 fsPath 为 //authority/path
    // @link https://www3.trustwave.com/support/kb/KnowledgebaseArticle10870.aspx
    const workspaceUri = new URI('file:///root');
    const newWorkspaceUri = workspaceUri.resolve('new_folder');
    injector.mock(IWorkspaceService, 'roots', [
      {
        uri: workspaceUri.toString(),
        lastModification: new Date().getTime(),
        isDirectory: true,
      },
    ]);
    const result = await workspaceService.asRelativePath(newWorkspaceUri);
    expect(result).toBe('new_folder');
    expect(await workspaceService.asRelativePath(newWorkspaceUri.codeUri.fsPath)).toBe('new_folder');
    const outWorkspacePath = '/other/test.js';
    expect(await workspaceService.asRelativePath(outWorkspacePath)).toBe(outWorkspacePath);

    done();
  });
});
