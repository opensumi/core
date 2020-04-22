import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { URI, CorePreferences, Disposable } from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { Directory } from '../../../src/browser/file-tree-nodes';
import { TreeNodeType } from '@ali/ide-components';
import { FileTreeDialogModel } from '../../../src/browser/dialog/file-dialog-model.service';
import { FileTreeDecorationService } from '../../../src/browser/services/file-tree-decoration.service';

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
      getTreeNodeAtIndex: () => {
        return root;
      },
    };
    mockFileTreeDialogService.resolveChildren.mockResolvedValueOnce([
      root,
    ]);
    mockFileTreeDialogService.resolveRoot.mockResolvedValue([
      root,
    ]);
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

});
