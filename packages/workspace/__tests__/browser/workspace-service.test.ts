import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IWorkspaceService } from '@ali/ide-workspace';
import { URI, IFileServiceClient, Disposable, StorageProvider } from '@ali/ide-core-common';
import { PreferenceService, CorePreferences, FILES_DEFAULTS } from '@ali/ide-core-browser';
import { WorkspaceModule } from '../../src/browser';
import { FileStat } from '@ali/ide-file-service';
import { WorkspacePreferences } from '../../src/browser/workspace-preferences';

describe('WorkspaceService should be work while workspace was a single directory', () => {
  let workspaceService: IWorkspaceService;
  let injector: MockInjector;
  const workspaceUri = new URI('file://userhome/');
  const mockFileSystem = {
    onFilesChanged: jest.fn(),
    watchFileChanges: jest.fn(() => Disposable.create(() => {})),
    setWatchFileExcludes: jest.fn(),
    setFilesExcludes: jest.fn(),
    getFileStat: jest.fn(() => {
      return {
        uri: workspaceUri.toString(),
        lastModification: new Date().getTime(),
        isDirectory: true,
      } as FileStat;
    }),
    exists: jest.fn(() => true),
  };
  const mockCorePreferences = {
    onPreferenceChanged: jest.fn(),
    'files.watcherExclude': FILES_DEFAULTS.filesWatcherExclude,
    'files.exclude': FILES_DEFAULTS.filesExclude,
  };
  const mockWorkspacePreferences = {
    onPreferenceChanged: jest.fn(),
  };
  const mockRecentStorage = {
    get: jest.fn((name) => {
      if (name === 'RECENT_WORKSPACES') {
        return [];
      } else if (name === 'RECENT_COMMANDS') {
        return [];
      }
    }),
    set: jest.fn(),
  };
  beforeEach(async (done) => {
    injector = createBrowserInjector([
      WorkspaceModule,
    ]);

    injector.overrideProviders(
      {
        token: PreferenceService,
        useValue: {},
      },
      {
        token: IFileServiceClient,
        useValue: mockFileSystem,
      },
      {
        token: CorePreferences,
        useValue: mockCorePreferences,
      },
      {
        token: StorageProvider,
        useValue: () => mockRecentStorage,
      },
      {
        token: WorkspacePreferences,
        useValue: mockWorkspacePreferences,
      },
    );

    workspaceService = injector.get(IWorkspaceService);
    await workspaceService.whenReady;
    done();
  });

  afterEach(() => {
  });

  describe('01 #Init', () => {
    it('should have enough API', async (done) => {
      expect(workspaceService.workspace).toBeDefined();
      expect(mockFileSystem.watchFileChanges).toBeCalledWith(new URI(workspaceService.workspace!.uri));
      expect(mockFileSystem.onFilesChanged).toBeCalledTimes(1);
      expect(mockFileSystem.setFilesExcludes).toBeCalledTimes(1);
      expect(mockFileSystem.setWatchFileExcludes).toBeCalledTimes(1);
      expect(mockRecentStorage.set).toBeCalledWith([workspaceService.workspace!.uri]);
      expect((await workspaceService.roots).length).toBe(1);
      done();
    });
  });

  describe('02 #API should be worked.', () => {

  });
});
