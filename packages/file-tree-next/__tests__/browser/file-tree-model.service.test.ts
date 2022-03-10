import { TreeNodeType } from '@opensumi/ide-components';
import {
  URI,
  Disposable,
  IContextKeyService,
  StorageProvider,
  ILogger,
  IApplicationService,
  isWindows,
  isLinux,
  OS,
  Emitter,
} from '@opensumi/ide-core-browser';
import { MockLogger } from '@opensumi/ide-core-browser/__mocks__/logger';
import { ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { IDecorationsService } from '@opensumi/ide-decoration';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileTreeService } from '@opensumi/ide-file-tree-next';
import { IFileTreeAPI } from '@opensumi/ide-file-tree-next';
import { FileContextKey } from '@opensumi/ide-file-tree-next/lib/browser/file-contextkey';
import { FileTreeModelService } from '@opensumi/ide-file-tree-next/lib/browser/services/file-tree-model.service';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';
import { IThemeService } from '@opensumi/ide-theme';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../..//monaco/__mocks__/monaco.context-key.service';
import { createMockedMonaco } from '../../../monaco/__mocks__/monaco';
import styles from '../../src/browser/file-tree-node.modules.less';
import { Directory, File } from '../../src/common/file-tree-node.define';

class TempDirectory {}

describe('FileTreeModelService should be work', () => {
  (global as any).monaco = createMockedMonaco() as any;
  let injector: MockInjector;
  let contextKey: FileContextKey;
  let fileTreeModelService: FileTreeModelService;
  const rootUri = URI.file('/userhome');
  const mockWatcher = {
    callback: jest.fn(),
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

  const mockRoot = {
    ...newDirectoryByName('testRoot'),
    watcher: {
      on: jest.fn(() => Disposable.create(() => {})),
      notifyDidChangeMetadata: jest.fn(),
    },
    watchEvents: {
      get: jest.fn(() => mockWatcher),
    },
    path: 'testRoot',
    name: 'testRoot',
    uri: rootUri,
  } as any;
  const mockCtxMenuRenderer = {
    show: jest.fn(),
  } as any;

  const mockDecorationsService = {
    onDidChangeDecorations: jest.fn(() => Disposable.create(() => {})),
  };
  const mockThemeService = {
    onThemeChange: jest.fn(() => Disposable.create(() => {})),
  };
  const mockExploreStorage = {
    get: jest.fn(() => ({
      specVersion: 1,
      scrollPosition: 100,
      expandedDirectories: {
        atSurface: [],
        buried: [],
      },
    })),
    set: jest.fn(),
  };
  const mockLabelService = {
    onDidChange: jest.fn(() => Disposable.create(() => {})),
  };
  const mockFileTreeService = {
    onNodeRefreshed: jest.fn(() => Disposable.create(() => {})),
    onWorkspaceChange: jest.fn(() => Disposable.create(() => {})),
    requestFlushEventSignalEvent: jest.fn(() => Disposable.create(() => {})),
    resolveChildren: jest.fn(() => [mockRoot]),
    startWatchFileEvent: jest.fn(),
    refresh: jest.fn(),
    contextMenuContextKeyService: new MockContextKeyService().createScoped({} as any),
    get contextKey() {
      return contextKey;
    },
  };
  beforeEach(async (done) => {
    injector = createBrowserInjector([]);

    injector.overrideProviders(
      {
        token: LabelService,
        useValue: mockLabelService,
      },
      {
        token: FileContextKey,
        useClass: FileContextKey,
      },
      {
        token: ICtxMenuRenderer,
        useValue: mockCtxMenuRenderer,
      },
      {
        token: ILogger,
        useClass: MockLogger,
      },
      {
        token: IFileTreeService,
        useValue: mockFileTreeService,
      },
      {
        token: StorageProvider,
        useValue: () => mockExploreStorage,
      },
      {
        token: IDecorationsService,
        useValue: mockDecorationsService,
      },
      {
        token: IThemeService,
        useValue: mockThemeService,
      },
      {
        token: IFileTreeAPI,
        useValue: {},
      },
      {
        token: IDialogService,
        useValue: {},
      },
      {
        token: IMessageService,
        useValue: {},
      },
      {
        token: WorkbenchEditorService,
        useValue: {},
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: IApplicationService,
        useValue: {
          backendOS: isWindows ? OS.Type.Windows : isLinux ? OS.Type.Linux : OS.Type.OSX,
        },
      },
    );
    contextKey = injector.get(FileContextKey, [document.createElement('div')]);

    const root = {
      ...newDirectoryByName('child'),
      ensureLoaded: jest.fn(),
      watcher: {
        on: () => Disposable.create(() => {}),
      },
      getTreeNodeAtIndex: () => root,
    };

    fileTreeModelService = injector.get(FileTreeModelService);
    fileTreeModelService.initTreeModel();
    await fileTreeModelService.whenReady;
    done();
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('should init success', () => {
    expect(mockLabelService.onDidChange).toBeCalledTimes(1);
    expect(mockFileTreeService.onNodeRefreshed).toBeCalledTimes(1);
    expect(mockFileTreeService.onWorkspaceChange).toBeCalledTimes(1);
    expect(mockFileTreeService.requestFlushEventSignalEvent).toBeCalledTimes(1);
    expect(mockFileTreeService.startWatchFileEvent).toBeCalledTimes(1);
    expect(mockThemeService.onThemeChange).toBeCalledTimes(1);
    expect(mockDecorationsService.onDidChangeDecorations).toBeCalledTimes(1);
    expect(fileTreeModelService.onDidFocusedFileChange).toBeDefined();
    expect(fileTreeModelService.onDidSelectedFileChange).toBeDefined();
    expect(fileTreeModelService.treeModel).toBeDefined();
  });

  it('activeFileDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeModelService.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeModelService.activeFileDecoration(node);
    const decoration = fileTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
  });

  it('activateFileActivedDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeModelService.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeModelService.activateFileActivedDecoration(node);
    const decoration = fileTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_actived]);
  });

  it('selectFileDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeModelService.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeModelService.selectFileDecoration(node);
    const decoration = fileTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('deactivateFileDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeModelService.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeModelService.activeFileDecoration(node);
    let decoration = fileTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    fileTreeModelService.deactivateFileDecoration();
    decoration = fileTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('removeFileDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeModelService.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeModelService.activeFileDecoration(node);
    let decoration = fileTreeModelService.decorations.getDecorations(node);
    fileTreeModelService.removeFileDecoration();
    decoration = fileTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([]);
  });

  it('handleTreeHandler method should be work', () => {
    const errorEmitter = new Emitter();
    const treeHandle = { ensureVisible: () => {}, onError: errorEmitter.event } as any;
    fileTreeModelService.handleTreeHandler(treeHandle);
    expect(fileTreeModelService.fileTreeHandle).toEqual(treeHandle);
  });

  it('handleTreeBlur method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeModelService.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeModelService.initDecorations(mockRoot);
    fileTreeModelService.activeFileDecoration(node);
    let decoration = fileTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    fileTreeModelService.handleTreeBlur();
    decoration = fileTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('clearFileSelectedDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeModelService.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeModelService.selectFileDecoration(node);
    const decoration = fileTreeModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
    fileTreeModelService.clearFileSelectedDecoration();
    expect(decoration!.classlist).toEqual([]);
  });

  it('toggleDirectory method should be work', async (done) => {
    const errorEmitter = new Emitter();
    const treeHandle = { collapseNode: jest.fn(), expandNode: jest.fn(), onError: errorEmitter.event } as any;
    let mockNode = { expanded: false };
    fileTreeModelService.handleTreeHandler(treeHandle);
    await fileTreeModelService.toggleDirectory(mockNode as any);
    expect(treeHandle.expandNode).toBeCalledTimes(1);
    mockNode = { expanded: true };
    await fileTreeModelService.toggleDirectory(mockNode as any);
    expect(treeHandle.collapseNode).toBeCalledTimes(1);
    done();
  });

  it('handleContextMenu method should be work', () => {
    const mockNode: Directory = newDirectoryByName('testDirectory');
    const mockEvent = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
      nativeEvent: {
        x: 1,
        y: 1,
      },
    } as any;
    fileTreeModelService.handleContextMenu(mockEvent, mockNode);
    expect(mockCtxMenuRenderer.show).toBeCalledTimes(1);
    expect(mockEvent.stopPropagation).toBeCalledTimes(1);
    expect(mockEvent.preventDefault).toBeCalledTimes(1);
  });
  it('should set correct context key', () => {
    const mockNode: Directory = newDirectoryByName('testDirectory');
    const mockEvent = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
      nativeEvent: {
        x: 1,
        y: 1,
      },
    } as any;

    expect(fileTreeModelService.contextKey.explorerResourceIsFolder.get()).toBeFalsy();

    fileTreeModelService.handleContextMenu(mockEvent, mockNode);
    // show context key in folder
    expect(fileTreeModelService.contextKey.explorerResourceIsFolder.get()).toBeTruthy();

    // blur
    fileTreeModelService.handleTreeBlur();
    expect(fileTreeModelService.contextKey.explorerResourceIsFolder.get()).toBeFalsy();

    // click in empty area
    fileTreeModelService.handleContextMenu(mockEvent, undefined);
    expect(fileTreeModelService.contextKey.explorerResourceIsFolder.get()).toBeTruthy();
  });
});
