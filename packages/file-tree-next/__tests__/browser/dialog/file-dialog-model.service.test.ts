import { TreeNodeType } from '@opensumi/ide-components';
import { URI, CorePreferences, Disposable } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { FileTreeDialogModel } from '../../../src/browser/dialog/file-dialog-model.service';
import styles from '../../../src/browser/file-tree-node.modules.less';
import { FileTreeDecorationService } from '../../../src/browser/services/file-tree-decoration.service';
import { Directory, File } from '../../../src/common/file-tree-node.define';

class TempDirectory {}

describe('FileDialogModel should be work', () => {
  let injector: MockInjector;
  let fileTreeDialogModel: FileTreeDialogModel;
  const rootUri = URI.file('/userhome');
  const mockFileTreeDialogService = {
    resolveChildren: jest.fn() as any,
    resolveRoot: jest.fn() as any,
    getDirectoryList: jest.fn() as any,
  } as any;
  const mockWatcher = {
    callback: jest.fn(),
  };
  const mockRoot = {
    watcher: {
      on: jest.fn(() => Disposable.create(() => {})),
      notifyDidChangeMetadata: jest.fn(),
    },
    watchEvents: {
      get: jest.fn(() => mockWatcher),
    },
    path: 'testRoot',
    uri: rootUri,
  } as any;
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
  beforeEach(async (done) => {
    injector = createBrowserInjector([]);

    injector.overrideProviders(
      {
        token: LabelService,
        useValue: {
          onDidChange: () => Disposable.create(() => {}),
        },
      },
      {
        token: CorePreferences,
        useValue: {},
      },
      {
        token: FileTreeDecorationService,
        useValue: {
          onDidChange: () => {},
        },
      },
    );
    const root = {
      ...newDirectoryByName('child'),
      ensureLoaded: jest.fn(),
      watcher: {
        on: () => Disposable.create(() => {}),
      },
      getTreeNodeAtIndex: () => root,
    };
    mockFileTreeDialogService.resolveChildren.mockResolvedValueOnce([root]);
    mockFileTreeDialogService.resolveRoot.mockResolvedValue([root]);
    fileTreeDialogModel = FileTreeDialogModel.createModel(injector, mockFileTreeDialogService);
    await fileTreeDialogModel.whenReady;
    done();
  });

  afterEach(() => {
    injector.disposeAll();
    mockFileTreeDialogService.resolveChildren.mockReset();
    mockFileTreeDialogService.resolveRoot.mockReset();
    mockFileTreeDialogService.getDirectoryList.mockReset();
  });

  it('some property should be defined', () => {
    expect(fileTreeDialogModel.onDidFocusedFileChange).toBeDefined();
    expect(fileTreeDialogModel.onDidSelectedFileChange).toBeDefined();
    expect(fileTreeDialogModel.treeModel).toBeDefined();
  });

  it('updateTreeModel method should be work', async (done) => {
    await fileTreeDialogModel.updateTreeModel(rootUri.resolve('test').toString());
    expect(mockFileTreeDialogService.resolveRoot).toBeCalledTimes(1);
    done();
  });

  it('getDirectoryList method should be work', () => {
    fileTreeDialogModel.getDirectoryList();
    expect(mockFileTreeDialogService.getDirectoryList).toBeCalledTimes(1);
  });

  it('activeFileDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeDialogModel.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeDialogModel.activeFileDecoration(node);
    const decoration = fileTreeDialogModel.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
  });

  it('selectFileDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeDialogModel.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeDialogModel.selectFileDecoration(node);
    const decoration = fileTreeDialogModel.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('enactiveFileDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeDialogModel.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeDialogModel.activeFileDecoration(node);
    let decoration = fileTreeDialogModel.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    fileTreeDialogModel.enactiveFileDecoration();
    decoration = fileTreeDialogModel.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('removeFileDecoration method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeDialogModel.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeDialogModel.activeFileDecoration(node);
    let decoration = fileTreeDialogModel.decorations.getDecorations(node);
    fileTreeDialogModel.removeFileDecoration();
    decoration = fileTreeDialogModel.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([]);
  });

  it('handleTreeHandler method should be work', () => {
    const treeHandle = { ensureVisible: () => {} } as any;
    fileTreeDialogModel.handleTreeHandler(treeHandle);
    expect(fileTreeDialogModel.fileTreeHandle).toEqual(treeHandle);
  });

  it('handleTreeBlur method should be work', () => {
    const mockFileTreeService = {
      on: jest.fn(),
    } as any;
    fileTreeDialogModel.initDecorations(mockRoot);
    const node = new File(
      mockFileTreeService,
      mockRoot,
      mockRoot.uri.resolve('test.js'),
      'test.js',
      undefined,
      'tooltip',
    );
    fileTreeDialogModel.initDecorations(mockRoot);
    fileTreeDialogModel.activeFileDecoration(node);
    let decoration = fileTreeDialogModel.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    fileTreeDialogModel.handleTreeBlur();
    decoration = fileTreeDialogModel.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('handleTwistierClick method should be work', () => {
    const treeHandle = { collapseNode: jest.fn(), expandNode: jest.fn() } as any;
    let mockNode = { expanded: false };
    fileTreeDialogModel.handleTreeHandler(treeHandle);
    fileTreeDialogModel.toggleDirectory(mockNode as any);
    expect(treeHandle.expandNode).toBeCalledTimes(1);
    mockNode = { expanded: true };
    fileTreeDialogModel.toggleDirectory(mockNode as any);
    expect(treeHandle.collapseNode).toBeCalledTimes(1);
  });
});
