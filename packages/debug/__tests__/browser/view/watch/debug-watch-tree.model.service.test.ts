import { IContextKeyService, StorageProvider } from '@opensumi/ide-core-browser';
import { MockedStorageProvider } from '@opensumi/ide-core-browser/__mocks__/storage';
import { ICtxMenuRenderer, AbstractContextMenuService } from '@opensumi/ide-core-browser/lib/menu/next';
import { Disposable } from '@opensumi/ide-core-common';
import { IDebugSessionManager } from '@opensumi/ide-debug';
import { DebugHoverSource } from '@opensumi/ide-debug/lib/browser/editor/debug-hover-source';
import { DebugWatchNode } from '@opensumi/ide-debug/lib/browser/tree';
import { DebugWatchModelService } from '@opensumi/ide-debug/lib/browser/view/watch/debug-watch-tree.model.service';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import styles from '../../../../src/browser/view/watch/debug-watch.module.less';

describe('Debug Watch Tree Model', () => {
  const mockInjector = createBrowserInjector([]);
  let debugWatchModelService: DebugWatchModelService;
  const mockDebugHoverSource = {
    onDidChange: jest.fn(() => Disposable.create(() => {})),
  } as any;

  const mockCtxMenuRenderer = {
    show: jest.fn(),
  } as any;

  const mockWatcher = {
    callback: jest.fn(),
  };
  const mockRoot = {
    watcher: {
      on: jest.fn(() => Disposable.create(() => {})),
    },
    watchEvents: {
      get: jest.fn(() => mockWatcher),
    },
    path: 'testRoot',
  } as any;

  const mockDebugSessionManager = {
    onDidDestroyDebugSession: jest.fn(() => Disposable.create(() => {})),
    onDidChangeActiveDebugSession: jest.fn(() => Disposable.create(() => {})),
    onDidStopDebugSession: jest.fn(() => Disposable.create(() => {})),
  };

  const mockMenuService = {
    createMenu: jest.fn(() => ({
      getMergedMenuNodes: () => [],
      dispose: () => {},
    })),
  };

  const mockContextKeyService = {
    createScoped: jest.fn(),
    createKey: jest.fn(() => ({
      set: jest.fn(),
    })),
  };

  beforeAll(async (done) => {
    mockInjector.overrideProviders({
      token: DebugHoverSource,
      useValue: mockDebugHoverSource,
    });
    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: mockDebugSessionManager,
    });
    mockInjector.overrideProviders({
      token: StorageProvider,
      useValue: MockedStorageProvider,
    });
    mockInjector.overrideProviders({
      token: ICtxMenuRenderer,
      useValue: mockCtxMenuRenderer,
    });
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: mockContextKeyService,
    });

    mockInjector.overrideProviders({
      token: AbstractContextMenuService,
      useValue: mockMenuService,
    });

    debugWatchModelService = mockInjector.get(DebugWatchModelService);

    await debugWatchModelService.load();
    done();
  });

  afterAll(() => {
    debugWatchModelService.dispose();
  });

  it('should have enough API', () => {
    expect(typeof debugWatchModelService.listenTreeViewChange).toBe('function');
    expect(typeof debugWatchModelService.dispose).toBe('function');
    expect(typeof debugWatchModelService.onDidUpdateTreeModel).toBe('function');
    expect(typeof debugWatchModelService.initTreeModel).toBe('function');
    expect(typeof debugWatchModelService.initDecorations).toBe('function');
    expect(typeof debugWatchModelService.activeNodeDecoration).toBe('function');
    expect(typeof debugWatchModelService.enactiveNodeDecoration).toBe('function');
    expect(typeof debugWatchModelService.removeNodeDecoration).toBe('function');
    expect(typeof debugWatchModelService.handleTreeHandler).toBe('function');
    expect(typeof debugWatchModelService.handleTreeBlur).toBe('function');
    expect(typeof debugWatchModelService.handleTwistierClick).toBe('function');
    expect(typeof debugWatchModelService.toggleDirectory).toBe('function');
    expect(typeof debugWatchModelService.refresh).toBe('function');
    expect(typeof debugWatchModelService.flushEventQueue).toBe('function');
    expect(typeof debugWatchModelService.load).toBe('function');
    expect(typeof debugWatchModelService.save).toBe('function');
    expect(debugWatchModelService.decorations).toBeDefined();
    expect(debugWatchModelService.treeModel).toBeDefined();
    expect(debugWatchModelService.flushEventQueuePromise).toBeUndefined();
    expect(debugWatchModelService.treeHandle).toBeUndefined();
    expect(debugWatchModelService.focusedNode).toBeUndefined();
    expect(Array.isArray(debugWatchModelService.selectedNodes)).toBeTruthy();
  });

  it('initTreeModel method should be work', async (done) => {
    debugWatchModelService.onDidUpdateTreeModel(() => {
      done();
    });
    debugWatchModelService.initTreeModel();
  });

  it('activeNodeDecoration method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugWatchModelService.initDecorations(mockRoot);
    const node = new DebugWatchNode(mockSession, 'test', mockRoot);
    debugWatchModelService.activeNodeDecoration(node);
    const decoration = debugWatchModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
  });

  it('enactiveNodeDecoration method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugWatchModelService.initDecorations(mockRoot);
    const node = new DebugWatchNode(mockSession, 'test', mockRoot);
    debugWatchModelService.activeNodeDecoration(node);
    let decoration = debugWatchModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    debugWatchModelService.enactiveNodeDecoration();
    decoration = debugWatchModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('removeNodeDecoration method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugWatchModelService.initDecorations(mockRoot);
    const node = new DebugWatchNode(mockSession, 'test', mockRoot);
    debugWatchModelService.activeNodeDecoration(node);
    let decoration = debugWatchModelService.decorations.getDecorations(node);
    debugWatchModelService.removeNodeDecoration();
    decoration = debugWatchModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([]);
  });

  it('handleTreeHandler method should be work', () => {
    const treeHandle = { ensureVisible: () => {} } as any;
    debugWatchModelService.handleTreeHandler(treeHandle);
    expect(debugWatchModelService.treeHandle).toEqual(treeHandle);
  });

  it('handleTreeBlur method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugWatchModelService.initDecorations(mockRoot);
    const node = new DebugWatchNode(mockSession, 'test', mockRoot);
    debugWatchModelService.initDecorations(mockRoot);
    debugWatchModelService.activeNodeDecoration(node);
    let decoration = debugWatchModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    debugWatchModelService.handleTreeBlur();
    decoration = debugWatchModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('handleTwistierClick method should be work', () => {
    const treeHandle = { collapseNode: jest.fn(), expandNode: jest.fn() } as any;
    let mockNode = { expanded: false };
    debugWatchModelService.handleTreeHandler(treeHandle);
    debugWatchModelService.toggleDirectory(mockNode as any);
    expect(treeHandle.expandNode).toBeCalledTimes(1);
    mockNode = { expanded: true };
    debugWatchModelService.toggleDirectory(mockNode as any);
    expect(treeHandle.collapseNode).toBeCalledTimes(1);
  });

  it('handleContextMenu method should be work', () => {
    const mockNode = { expanded: false } as any;
    const mockEvent = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
      nativeEvent: {
        x: 1,
        y: 1,
      },
    } as any;
    debugWatchModelService.handleContextMenu(mockEvent, mockNode);
    expect(mockCtxMenuRenderer.show).toBeCalledTimes(1);
    expect(mockEvent.stopPropagation).toBeCalledTimes(1);
    expect(mockEvent.preventDefault).toBeCalledTimes(1);
  });

  it('refresh method should be work', async (done) => {
    debugWatchModelService.onDidRefreshed(() => {
      done();
    });
    debugWatchModelService.refresh(debugWatchModelService.treeModel?.root as any);
  });
});
