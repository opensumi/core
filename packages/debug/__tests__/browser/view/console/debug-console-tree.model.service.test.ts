import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { Disposable } from '@ali/ide-core-common';
import { DebugHoverSource } from '@ali/ide-debug/lib/browser/editor/debug-hover-source';
import { IDebugSessionManager } from '@ali/ide-debug';
import { DebugConsoleNode } from '@ali/ide-debug/lib/browser/tree';
import { ICtxMenuRenderer, AbstractContextMenuService } from '@ali/ide-core-browser/lib/menu/next';
import * as styles from '../../../../src/browser/view/console/debug-console.module.less';
import { DebugConsoleModelService } from '@ali/ide-debug/lib/browser/view/console/debug-console-tree.model.service';
import { IContextKeyService } from '@ali/ide-core-browser';

describe('Debug Console Tree Model', () => {
  const mockInjector = createBrowserInjector([]);
  let debugConsoleModelService: DebugConsoleModelService;
  const mockDebugHoverSource = {
    onDidChange: jest.fn(() => Disposable.create(() => { })),
  } as any;

  const mockWatcher = {
    callback: jest.fn(),
  };
  const mockRoot = {
    watcher: {
      on: jest.fn(() => Disposable.create(() => { })),
    },
    watchEvents: {
      get: jest.fn(() => mockWatcher),
    },
    path: 'testRoot',
  } as any;

  const mockDebugSessionManager = {
    onDidDestroyDebugSession: jest.fn(() => Disposable.create(() => { })),
    onDidChangeActiveDebugSession: jest.fn(() => Disposable.create(() => { })),
  };

  const mockMenuService = {
    createMenu: jest.fn(() => ({
      getMergedMenuNodes: () => [],
      dispose: () => {},
    })),
  };

  const mockContextKeyService = {
    createScoped: jest.fn(),
  };

  const mockCtxMenuRenderer = {
    show: jest.fn(),
  } as any;

  beforeAll(() => {
    mockInjector.overrideProviders({
      token: DebugHoverSource,
      useValue: mockDebugHoverSource,
    });
    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: mockDebugSessionManager,
    });
    mockInjector.overrideProviders({
      token: ICtxMenuRenderer,
      useValue: mockCtxMenuRenderer,
    });
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: mockCtxMenuRenderer,
    });

    mockInjector.overrideProviders({
      token: AbstractContextMenuService,
      useValue: mockMenuService,
    });

    mockInjector.overrideProviders({
      token: ICtxMenuRenderer,
      useValue: mockCtxMenuRenderer,
    });
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: mockContextKeyService,
    });

    debugConsoleModelService = mockInjector.get(DebugConsoleModelService);
  });

  afterAll(() => {
    debugConsoleModelService.dispose();
  });

  it('should have enough API', () => {
    expect(typeof debugConsoleModelService.listenTreeViewChange).toBe('function');
    expect(typeof debugConsoleModelService.dispose).toBe('function');
    expect(typeof debugConsoleModelService.onDidUpdateTreeModel).toBe('function');
    expect(typeof debugConsoleModelService.initTreeModel).toBe('function');
    expect(typeof debugConsoleModelService.initDecorations).toBe('function');
    expect(typeof debugConsoleModelService.activeNodeDecoration).toBe('function');
    expect(typeof debugConsoleModelService.activeNodeFocusedDecoration).toBe('function');
    expect(typeof debugConsoleModelService.enactiveNodeDecoration).toBe('function');
    expect(typeof debugConsoleModelService.removeNodeDecoration).toBe('function');
    expect(typeof debugConsoleModelService.handleTreeHandler).toBe('function');
    expect(typeof debugConsoleModelService.handleTreeBlur).toBe('function');
    expect(typeof debugConsoleModelService.handleTwistierClick).toBe('function');
    expect(typeof debugConsoleModelService.toggleDirectory).toBe('function');
    expect(typeof debugConsoleModelService.refresh).toBe('function');
    expect(typeof debugConsoleModelService.flushEventQueue).toBe('function');
    expect(debugConsoleModelService.flushEventQueuePromise).toBeUndefined();
    expect(debugConsoleModelService.treeHandle).toBeUndefined();
    expect(debugConsoleModelService.decorations).toBeUndefined();
    expect(debugConsoleModelService.treeModel).toBeUndefined();
    expect(debugConsoleModelService.focusedNode).toBeUndefined();
    expect(Array.isArray(debugConsoleModelService.selectedNodes)).toBeTruthy();
  });

  it('should init success', () => {
    expect(mockDebugSessionManager.onDidDestroyDebugSession).toBeCalledTimes(1);
    expect(mockDebugSessionManager.onDidChangeActiveDebugSession).toBeCalledTimes(1);
  });

  it('initTreeModel method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugConsoleModelService.initTreeModel(mockSession);
    expect(mockSession.on).toBeCalledTimes(1);
  });

  it('activeNodeDecoration method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugConsoleModelService.initDecorations(mockRoot);
    const node = new DebugConsoleNode(mockSession, 'test', mockRoot);
    debugConsoleModelService.activeNodeDecoration(node);
    const decoration = debugConsoleModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
  });

  it('enactiveNodeDecoration method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugConsoleModelService.initDecorations(mockRoot);
    const node = new DebugConsoleNode(mockSession, 'test', mockRoot);
    debugConsoleModelService.activeNodeDecoration(node);
    let decoration = debugConsoleModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    debugConsoleModelService.enactiveNodeDecoration();
    decoration = debugConsoleModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('removeNodeDecoration method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugConsoleModelService.initDecorations(mockRoot);
    const node = new DebugConsoleNode(mockSession, 'test', mockRoot);
    debugConsoleModelService.activeNodeDecoration(node);
    let decoration = debugConsoleModelService.decorations.getDecorations(node);
    debugConsoleModelService.removeNodeDecoration();
    decoration = debugConsoleModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([]);
  });

  it('handleTreeHandler method should be work', () => {
    const treeHandle = { ensureVisible: () => { } } as any;
    debugConsoleModelService.handleTreeHandler(treeHandle);
    expect(debugConsoleModelService.treeHandle).toEqual(treeHandle);
  });

  it('handleTreeBlur method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugConsoleModelService.initDecorations(mockRoot);
    const node = new DebugConsoleNode(mockSession, 'test', mockRoot);
    debugConsoleModelService.initDecorations(mockRoot);
    debugConsoleModelService.activeNodeDecoration(node);
    let decoration = debugConsoleModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    debugConsoleModelService.handleTreeBlur();
    decoration = debugConsoleModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('handleTwistierClick method should be work', () => {
    const treeHandle = { collapseNode: jest.fn(), expandNode: jest.fn() } as any;
    let mockNode = { expanded: false };
    debugConsoleModelService.handleTreeHandler(treeHandle);
    debugConsoleModelService.toggleDirectory(mockNode as any);
    expect(treeHandle.expandNode).toBeCalledTimes(1);
    mockNode = { expanded: true };
    debugConsoleModelService.toggleDirectory(mockNode as any);
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
    debugConsoleModelService.handleContextMenu(mockEvent, mockNode);
    expect(mockCtxMenuRenderer.show).toBeCalledTimes(1);
    expect(mockEvent.stopPropagation).toBeCalledTimes(1);
    expect(mockEvent.preventDefault).toBeCalledTimes(1);

  });

  it('refresh method should be work', async (done) => {
    debugConsoleModelService.onDidRefreshed(() => {
      done();
    });
    debugConsoleModelService.refresh(debugConsoleModelService.treeModel?.root as any);
  });
});
