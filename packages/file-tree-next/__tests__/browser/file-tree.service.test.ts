import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { FileTreeService } from '../../src/browser/file-tree.service';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IContextKeyService, CorePreferences, Disposable, URI, EDITOR_COMMANDS, FILE_COMMANDS, ILoggerManagerClient } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-core-browser/lib/mocks/context-key';
import { IWorkspaceService, KAITIAN_MULTI_WORKSPACE_EXT } from '@ali/ide-workspace';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { IFileServiceClient, FileChangeType } from '@ali/ide-file-service';
import { FileTreeContribution } from '../../src/browser/file-tree-contribution';
import { IDecorationsService } from '@ali/ide-decoration';
import { IMainLayoutService, IViewsRegistry } from '@ali/ide-main-layout';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IWindowDialogService, IDialogService, IMessageService } from '@ali/ide-overlay';
import { IFileTreeAPI, IFileTreeService } from '../../src/common';
import { IThemeService, IIconService } from '@ali/ide-theme';
import { Directory, File } from '../../src/common/file-tree-node.define';
import { TreeNodeType } from '@ali/ide-components';
import { ViewsRegistry } from '@ali/ide-main-layout/lib/browser/views-registry';

class TempDirectory {}
class TempFile {}

describe('FileTree Service should be work alone', () => {
  let injector: MockInjector;
  let fileTreeService: FileTreeService;
  let onPreferenceChanged;
  let mockFileServiceClient;
  let fileChangeWatcher;
  const rootUri = URI.file('/userhome');
  const newFileByName = (name) => {
    const file = {
      uri: rootUri.resolve(name),
      name,
      filestat: {
        uri: rootUri.resolve(name).toString(),
        isDirectory: false,
        lastModification: new Date().getTime(),
      },
      type: TreeNodeType.TreeNode,
    } as File;
    file.constructor = new TempFile().constructor;
    return file;
  };
  const newDirectoryByName = (name) => {
    const directory = {
      uri: rootUri.resolve(name),
      name,
      filestat: {
        uri: rootUri.resolve(name).toString(),
        isDirectory: true,
        lastModification: new Date().getTime(),
      },
      type: TreeNodeType.CompositeTreeNode,
    } as Directory;
    directory.constructor = new TempDirectory().constructor;
    return directory;
  };
  beforeEach(() => {
    injector = createBrowserInjector([]);
    onPreferenceChanged = jest.fn((valueChangeHandle) => {
      valueChangeHandle({
        preferenceName: 'explorer.fileTree.baseIndent',
        newValue: 6,
      });
      valueChangeHandle({
        preferenceName: 'explorer.fileTree.indent',
        newValue: 6,
      });
      return Disposable.create(() => {});
    });
    fileChangeWatcher = {
      onFilesChanged: jest.fn(() => Disposable.create(() => {})),
      dispose: () => {},
    };
    mockFileServiceClient = {
      watchFileChanges: jest.fn(() => fileChangeWatcher),
      dispose: () => {},
    };
    injector.overrideProviders(
      {
        token: IDecorationsService,
        useValue: {},
      },
      {
        token: IMainLayoutService,
        useValue: {},
      },
      {
        token: WorkbenchEditorService,
        useValue: {},
      },
      {
        token: IWindowDialogService,
        useValue: {},
      },
      {
        token: IDialogService,
        useValue: {},
      },
      {
        token: IThemeService,
        useValue: {},
      },
      {
        token: IIconService,
        useValue: {
          hasFolderIcon: true,
        },
      },
      {
        token: ILoggerManagerClient,
        useValue: {},
      },
      {
        token: IFileTreeAPI,
        useValue: {},
      },
      {
        token: IMessageService,
        useValue: {},
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: CorePreferences,
        useValue: {
          'explorer.fileTree.baseIndent': 8,
          'explorer.fileTree.indent': 8,
          onPreferenceChanged,
        },
      },
      {
        token: IFileServiceClient,
        useValue: mockFileServiceClient,
      },
      {
        token: IFileTreeService,
        useClass: FileTreeService,
      },
      {
        token: IViewsRegistry,
        useClass: ViewsRegistry,
      },
    );
    fileTreeService = injector.get(IFileTreeService);
  });

  afterEach(() => {
    injector.disposeAll();
    onPreferenceChanged.mockReset();
    mockFileServiceClient.watchFileChanges.mockReset();
    fileChangeWatcher.onFilesChanged.mockReset();
  });

  it('Service should be init correctly', async (done) => {
    await fileTreeService.init();
    expect(onPreferenceChanged).toBeCalled();
    expect(fileTreeService.indent).toBe(6);
    expect(fileTreeService.baseIndent).toBe(6);
    done();
  });

  it('ContextMenuContextKeyService should be existed', () => {
    expect(!!fileTreeService.contextMenuContextKeyService).toBeTruthy();
  });

  it('File watch should be work', async (done) => {
    const workspaceService = injector.get(IWorkspaceService);
    const testUri = new URI(workspaceService.workspace.uri);
    fileChangeWatcher.onFilesChanged.mockImplementation((fileChangeHandle) => {
      fileChangeHandle([
        {
          uri: testUri.resolve('test_0'),
          type: FileChangeType.UPDATED,
        },
        {
          uri: testUri.resolve('test_1'),
          type: FileChangeType.ADDED,
        },
        {
          uri: testUri.resolve('test_2'),
          type: FileChangeType.DELETED,
        },
      ]);
      return Disposable.create(() => {});
    });
    fileTreeService.startWatchFileEvent();
    await fileTreeService.watchFilesChange(testUri);
    expect(fileChangeWatcher.onFilesChanged).toBeCalledTimes(1);
    expect(mockFileServiceClient.watchFileChanges).toBeCalled();
    await fileTreeService.flushEventQueue();
    done();
  });

  it('Re-watch should be work while re-connect', async (done) => {
    const fileTreeContribution = injector.get(FileTreeContribution);
    const testUri = new URI('file://userhome/test.js');
    fileTreeService.startWatchFileEvent();
    await fileTreeService.watchFilesChange(testUri);
    await fileTreeContribution.onReconnect();
    expect(fileChangeWatcher.onFilesChanged).toBeCalledTimes(2);
    done();
  });

  it('Commands should be work', () => {
    const testUri = new URI('file://userhome/test.js');
    // openAndFixedFile
    const mockOpenResource = jest.fn();
    injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, mockOpenResource);
    fileTreeService.openAndFixedFile(testUri);
    expect(mockOpenResource).toBeCalledWith(testUri,  { disableNavigate: true, preview: false, focus: true });
    // OpenToTheSide
    fileTreeService.openToTheSide(testUri);
    expect(mockOpenResource).toBeCalledWith(testUri,  { disableNavigate: true, split: 4 });
    // compare
    const mockCompare = jest.fn();
    injector.mockCommand(EDITOR_COMMANDS.COMPARE.id, mockCompare);
    fileTreeService.compare(testUri, testUri);
    expect(mockCompare).toBeCalledWith({
      original: testUri,
      modified: testUri,
    });
    // toggleFilterMode
    const mockLocation = jest.fn();
    injector.mockCommand(FILE_COMMANDS.LOCATION.id, mockLocation);
    fileTreeService.toggleFilterMode();
    // set filterMode to true
    fileTreeService.toggleFilterMode();
    expect(mockLocation).toBeCalledTimes(1);
    // enableFilterMode
    fileTreeService.enableFilterMode();
    expect(fileTreeService.filterMode).toBeTruthy();
    // locationToCurrentFile
    fileTreeService.locationToCurrentFile();
    expect(mockLocation).toBeCalledTimes(2);
  });

  it('sortComparator method should be work', () => {
    let res = fileTreeService.sortComparator(newFileByName('a'), newDirectoryByName('a'));
    expect(res).toBe(1);
    res = fileTreeService.sortComparator(newFileByName('a'), newFileByName('b'));
    expect(res).toBe(-1);
    res = fileTreeService.sortComparator(newDirectoryByName('a'), newDirectoryByName('b'));
    expect(res).toBe(-1);
    res = fileTreeService.sortComparator(newDirectoryByName('a'), newDirectoryByName('a'));
    expect(res).toBe(0);
    res = fileTreeService.sortComparator(newFileByName('a'), newFileByName('a'));
  });
});

describe('FileTree Service should be work alone on multiple workspace mode', () => {
  let injector: MockInjector;
  let fileTreeService: FileTreeService;
  let onPreferenceChanged;
  let mockFileServiceClient;
  let fileChangeWatcher;
  beforeEach(() => {
    injector = createBrowserInjector([]);
    onPreferenceChanged = jest.fn((valueChangeHandle) => {
      valueChangeHandle({
        preferenceName: 'explorer.fileTree.baseIndent',
        newValue: 6,
      });
      valueChangeHandle({
        preferenceName: 'explorer.fileTree.indent',
        newValue: 6,
      });
      return Disposable.create(() => {});
    });
    fileChangeWatcher = {
      onFilesChanged: jest.fn(() => Disposable.create(() => {})),
      dispose: () => {},
    };
    mockFileServiceClient = {
      watchFileChanges: jest.fn(() => fileChangeWatcher),
      dispose: () => {},
    };
    injector.overrideProviders(
      {
        token: IDecorationsService,
        useValue: {},
      },
      {
        token: IMainLayoutService,
        useValue: {},
      },
      {
        token: WorkbenchEditorService,
        useValue: {},
      },
      {
        token: IWindowDialogService,
        useValue: {},
      },
      {
        token: IDialogService,
        useValue: {},
      },
      {
        token: IThemeService,
        useValue: {},
      },
      {
        token: IIconService,
        useValue: {
          hasFolderIcon: true,
        },
      },
      {
        token: ILoggerManagerClient,
        useValue: {},
      },
      {
        token: IFileTreeAPI,
        useValue: {},
      },
      {
        token: IMessageService,
        useValue: {},
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: CorePreferences,
        useValue: {
          'explorer.fileTree.baseIndent': 8,
          'explorer.fileTree.indent': 8,
          onPreferenceChanged,
        },
      },
      {
        token: IFileServiceClient,
        useValue: mockFileServiceClient,
      },
      {
        token: IFileTreeService,
        useClass: FileTreeService,
      },
    );
    fileTreeService = injector.get(IFileTreeService);
  });

  afterEach(() => {
    injector.disposeAll();
    onPreferenceChanged.mockReset();
    mockFileServiceClient.watchFileChanges.mockReset();
    fileChangeWatcher.onFilesChanged.mockReset();
  });

  // 以下为工作区模式工具函数测试
  it('getFileTreeNodePathByUri method should be work on multiple workspace mode', async (done) => {
    const workspaceService = injector.get(IWorkspaceService);
    workspaceService.isMultiRootWorkspaceOpened = true;
    await workspaceService.setWorkspace({
      isDirectory: false,
      lastModification: 0,
      uri: URI.file('folder1').resolve(`test.${KAITIAN_MULTI_WORKSPACE_EXT}`).toString(),
    });
    await workspaceService.spliceRoots(0, undefined, undefined, URI.file('folder1'), URI.file('folder2'));
    const path = await fileTreeService.getFileTreeNodePathByUri(URI.file('folder1').resolve('test'));
    expect(path).toBe('/folder1/test');
    done();
  });
});
