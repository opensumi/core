import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { Disposable, IFileServiceClient } from '@ali/ide-core-common';
import { DebugHoverSource } from '@ali/ide-debug/lib/browser/editor/debug-hover-source';
import { IDebugSessionManager, IDebugSession, DebugSessionOptions, DebugModelFactory, IDebugServer } from '@ali/ide-debug';
import { DebugConsoleNode } from '@ali/ide-debug/lib/browser/tree';
import { ICtxMenuRenderer, AbstractContextMenuService } from '@ali/ide-core-browser/lib/menu/next';
import styles from '../../../../src/browser/view/console/debug-console.module.less';
import { DebugConsoleModelService, IDebugConsoleModel } from '@ali/ide-debug/lib/browser/view/console/debug-console-tree.model.service';
import { IContextKeyService } from '@ali/ide-core-browser';
import { DebugSessionFactory, DefaultDebugSessionFactory, DebugPreferences, DebugSessionContributionRegistry } from '@ali/ide-debug/lib/browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IMessageService } from '@ali/ide-overlay';
import { ITerminalApiService } from '@ali/ide-terminal-next';
import { OutputService } from '@ali/ide-output/lib/browser/output.service';
import { IWorkspaceService } from '@ali/ide-workspace';
import { QuickPickService } from '@ali/ide-core-browser';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { WSChannelHandler } from '@ali/ide-connection';
import { IVariableResolverService } from '@ali/ide-variable';
import { ITaskService } from '@ali/ide-task';
import { DebugConsoleFilterService } from '@ali/ide-debug/lib/browser/view/console/debug-console-filter.service';

describe('Debug Console Tree Model', () => {
  const mockInjector = createBrowserInjector([]);
  let debugConsoleModelService: DebugConsoleModelService;
  let debugConsoleFilterService: DebugConsoleFilterService;
  let debugSessionFactory: DebugSessionFactory;
  const mockDebugHoverSource = {
    onDidChange: jest.fn(() => Disposable.create(() => { })),
  } as any;

  const createMockSession = (sessionId: string, options: Partial<DebugSessionOptions>): IDebugSession => {
    return debugSessionFactory.get(sessionId, options as any);
  };

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
    currentSession: IDebugSession,
    updateCurrentSession: jest.fn((session: IDebugSession | undefined) => { }),
  };
  // let mockDebugSessionManager: DebugSessionManager;

  const mockMenuService = {
    createMenu: jest.fn(() => ({
      getMergedMenuNodes: () => [],
      dispose: () => { },
    })),
  };

  let mockContextKeyService = {
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
    mockInjector.overrideProviders({
      token: DebugSessionFactory,
      useClass: DefaultDebugSessionFactory,
    });

    mockInjector.overrideProviders({
      token: WorkbenchEditorService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IMessageService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: DebugPreferences,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IFileServiceClient,
      useValue: {
        onFilesChanged: jest.fn(),
      },
    });
    mockInjector.overrideProviders({
      token: ITerminalApiService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: OutputService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: DebugModelFactory,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IWorkspaceService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IDebugServer,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: QuickPickService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IEditorDocumentModelService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: WSChannelHandler,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: DebugSessionContributionRegistry,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IVariableResolverService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: ITaskService,
      useValue: {},
    });

    debugConsoleModelService = mockInjector.get(DebugConsoleModelService);
    debugSessionFactory = mockInjector.get(DefaultDebugSessionFactory);
    debugConsoleFilterService = mockInjector.get(DebugConsoleFilterService);
    mockContextKeyService = mockInjector.get(IContextKeyService);
  });

  afterAll(() => {
    debugConsoleModelService.dispose();
  });

  it('should have enough API', () => {
    expect(typeof debugConsoleModelService.listenTreeViewChange).toBe('function');
    expect(typeof debugConsoleModelService.dispose).toBe('function');
    expect(typeof debugConsoleModelService.onDidUpdateTreeModel).toBe('function');
    expect(typeof debugConsoleModelService.initTreeModel).toBe('function');
    expect(typeof debugConsoleModelService.clear).toBe('function');
    expect(typeof debugConsoleModelService.initDecorations).toBe('function');
    expect(typeof debugConsoleModelService.activeNodeDecoration).toBe('function');
    expect(typeof debugConsoleModelService.activeNodeActivedDecoration).toBe('function');
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
    expect(typeof debugConsoleFilterService.onDidValueChange).toBe('function');
  });

  it('should init success', () => {
    expect(mockDebugSessionManager.onDidDestroyDebugSession).toBeCalledTimes(1);
    expect(mockDebugSessionManager.onDidChangeActiveDebugSession).toBeCalledTimes(1);
  });

  it('initTreeModel method should be work', () => {
    const mockSession = {
      on: jest.fn(),
      hasSeparateRepl: () => true,
      parentSession: undefined,
    } as Partial<IDebugSession>;
    debugConsoleModelService.initTreeModel(mockSession as any);
    expect(mockSession.on).toBeCalledTimes(1);
  });

  it('clear method should be work', () => {
    const mockSession = {
      on: jest.fn(),
      hasSeparateRepl: () => true,
      parentSession: undefined,
    } as Partial<IDebugSession>;
    mockDebugSessionManager.currentSession = mockSession as any;
    debugConsoleModelService.clear();
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

  it('repl merging', async (done) => {
    const treeHandle = { ensureVisible: () => { } } as any;
    debugConsoleModelService.handleTreeHandler(treeHandle);
    const getBranchSize = (repl: IDebugConsoleModel | undefined) => {
      return repl ? repl.treeModel.root.branchSize : 0;
    };
    const parent = createMockSession('parent', { repl: 'mergeWithParent' });
    createMockSession('child1', { parentSession: parent, repl: 'separate' });
    const child2 = createMockSession('child2', { parentSession: parent, repl: 'mergeWithParent' });
    createMockSession('grandChild', { parentSession: child2, repl: 'mergeWithParent' });
    createMockSession('child3', { parentSession: parent });

    const parentRepl = debugConsoleModelService.getConsoleModel('parent');
    const child1Repl = debugConsoleModelService.getConsoleModel('child1');
    const child2Repl = debugConsoleModelService.getConsoleModel('child2');
    const grandChildRepl = debugConsoleModelService.getConsoleModel('grandChild');
    const child3Repl = debugConsoleModelService.getConsoleModel('child3');

    mockDebugSessionManager.currentSession = parent as any;
    await debugConsoleModelService.execute('1\n');
    expect(getBranchSize(parentRepl)).toBeGreaterThanOrEqual(0);
    expect(getBranchSize(child1Repl)).toEqual(0);
    expect(getBranchSize(child2Repl)).toBeGreaterThanOrEqual(0);
    expect(getBranchSize(grandChildRepl)).toBeGreaterThanOrEqual(0);
    expect(getBranchSize(child3Repl)).toEqual(0);

    done();
  });

  it('repl filter service', () => {
    debugConsoleFilterService.setFilterText('KTTQL');
    expect(debugConsoleFilterService.filter('KATATAQALA')).toEqual(false);
    expect(debugConsoleFilterService.filter('KTTQLLLLLL')).toEqual(true);
    expect(debugConsoleFilterService.filter('🐜')).toEqual(false);
    expect(debugConsoleFilterService.filter('早上好我的工友们 KTTQL')).toEqual(true);
  });

  it('repl findMatches service', () => {
    debugConsoleFilterService.setFilterText('T');
    const matches = debugConsoleFilterService.findMatches('KTTQL吧, YYDS');
    expect(matches.length).toEqual(2);
    expect(matches[0].startIndex).toEqual(1);

    debugConsoleFilterService.setFilterText('吧');
    const matches2 = debugConsoleFilterService.findMatches('KTTQL吧, YYDS');
    expect(matches2.length).toEqual(1);
    expect(matches2[0].startIndex).toEqual(5);
  });
});
