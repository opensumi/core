import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import {
  Emitter,
  Disposable,
  CancellationTokenSource,
  CancellationToken,
  uuid,
  BinaryBuffer,
} from '@opensumi/ide-core-common';
import { ExtHostTreeViews } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.treeview';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { MainThreadAPIIdentifier, TreeView } from '../../../../src/common/vscode';
import { ExtHostCommands } from '../../../../src/hosted/api/vscode/ext.host.command';

const moackManThreadTreeView = {
  $registerTreeDataProvider: jest.fn(),
  $unregisterTreeDataProvider: jest.fn(() => Disposable.create(() => {})),
  $resolveDropFileData: jest.fn(() => BinaryBuffer.alloc(10)),
};

const mockMainThreadCommandProxy = {
  $executeCommand: jest.fn(() => new Promise(() => ({}))),
};

const map = new Map();

const rpcProtocol: IRPCProtocol = {
  getProxy: (key) => map.get(key),
  set: (key, value) => {
    map.set(key, value);
    return value;
  },
  get: (r) => map.get(r),
};

const onDidChangeTreeDataEmitter = new Emitter<void>();

const mockTreeViewItem = {
  id: 'tree-item-id',
  label: 'test',
  iconPath: '',
  description: '',
  contextValue: '',
};

const mockTreeDataProvider = {
  onDidChangeTreeData: onDidChangeTreeDataEmitter.event,
  getTreeItem: jest.fn(() => mockTreeViewItem),
  getChildren: jest.fn(() => [mockTreeViewItem.id]),
  getParent: jest.fn(),
  resolveTreeItem: jest.fn(),
};

describe('extension/__tests__/hosted/api/vscode/ext.host.treeview.test.ts', () => {
  let extHostTreeViews: ExtHostTreeViews;
  let extHostCommands: ExtHostCommands;

  const injector = createBrowserInjector([]);

  beforeAll(() => {
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadTreeView, moackManThreadTreeView as any);
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, mockMainThreadCommandProxy as any);

    extHostCommands = injector.get(ExtHostCommands, [rpcProtocol]);
    extHostTreeViews = injector.get(ExtHostTreeViews, [rpcProtocol, extHostCommands]);
  });

  afterAll(async () => {
    await injector.disposeAll();
  });

  it('registerTreeDataProvider should be work', () => {
    const treeViewId = 'registerTreeDataProvider-TreeViewId';
    extHostTreeViews.registerTreeDataProvider(treeViewId, mockTreeDataProvider);
    expect(moackManThreadTreeView.$registerTreeDataProvider).toBeCalledTimes(1);
  });

  it('resolveTreeItem should be work', async () => {
    const treeViewId = 'registerTreeDataProvider-TreeViewId';
    extHostTreeViews.registerTreeDataProvider(treeViewId, mockTreeDataProvider);
    await extHostTreeViews.$getChildren(treeViewId);
    extHostTreeViews.$resolveTreeItem(treeViewId, mockTreeViewItem.id, new CancellationTokenSource().token);
    expect(mockTreeDataProvider.resolveTreeItem).toBeCalledTimes(1);
  });

  describe('TreeViewAPI should be work', () => {
    const treeViewId = 'createTreeView-TreeViewId';
    let treeView: TreeView<any>;
    beforeAll(() => {
      treeView = extHostTreeViews.createTreeView<any>(treeViewId, { treeDataProvider: mockTreeDataProvider as any });
    });

    it('$getChildren method should be work', () => {
      mockTreeDataProvider.getChildren.mockClear();
      extHostTreeViews.$getChildren(treeViewId);
      expect(mockTreeDataProvider.getChildren).toBeCalledTimes(1);
    });

    it('$setExpanded method should be work while expand value to be true', (done) => {
      treeView.onDidExpandElement(() => {
        done();
      });
      extHostTreeViews.$setExpanded(treeViewId, mockTreeViewItem.id, true);
    });

    it('$setExpanded method should be work while expand value to be false', (done) => {
      treeView.onDidCollapseElement(() => {
        done();
      });
      extHostTreeViews.$setExpanded(treeViewId, mockTreeViewItem.id, false);
    });

    it('$setSelection method should be work', (done) => {
      treeView.onDidChangeSelection(() => {
        done();
      });
      extHostTreeViews.$setSelection(treeViewId, [mockTreeViewItem.id]);
    });

    it('$setVisible method should be work', (done) => {
      treeView.onDidChangeVisibility(() => {
        done();
      });
      extHostTreeViews.$setVisible(treeViewId, true);
    });
  });

  describe('Create TreeView with dragAndDropController', () => {
    const treeViewId = 'dragAndDropTreeView-TreeViewId';
    let treeView: TreeView<any>;
    const mockDragAndDropController = {
      dropMimeTypes: [],
      dragMimeTypes: [],
      handleDrag: jest.fn(),
      handleDrop: jest.fn(),
    } as any;
    beforeAll(async () => {
      treeView = extHostTreeViews.createTreeView<any>(treeViewId, {
        treeDataProvider: mockTreeDataProvider,
        dragAndDropController: mockDragAndDropController,
      });
      await extHostTreeViews.$getChildren(treeViewId);
    });

    it('$handleDrag method should be work', async () => {
      // Unknown TreeView
      await expect(
        extHostTreeViews.$handleDrag('unknown', [mockTreeViewItem.id], uuid(), new CancellationTokenSource().token),
      ).rejects.toThrowError();
      await extHostTreeViews.$handleDrag(
        treeViewId,
        [mockTreeViewItem.id],
        uuid(),
        new CancellationTokenSource().token,
      );
      expect(mockDragAndDropController.handleDrag).toBeCalledTimes(1);
    });

    it('$handleDrop method should be work', async () => {
      // Unknown TreeView
      await expect(
        extHostTreeViews.$handleDrop(
          'unknown',
          1,
          { items: [] },
          mockTreeViewItem.id,
          new CancellationTokenSource().token,
        ),
      ).rejects.toThrowError();
      await extHostTreeViews.$handleDrop(
        treeViewId,
        1,
        { items: [] },
        mockTreeViewItem.id,
        new CancellationTokenSource().token,
      );
      expect(mockDragAndDropController.handleDrop).toBeCalledTimes(1);
    });
  });
});
