import { Deferred, IContextKeyService } from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { Disposable } from '@opensumi/ide-core-common';
import { IDebugSessionManager } from '@opensumi/ide-debug';
import { DebugHoverSource } from '@opensumi/ide-debug/lib/browser/editor/debug-hover-source';
import { DebugConsoleNode } from '@opensumi/ide-debug/lib/browser/tree';
import { DebugViewModel } from '@opensumi/ide-debug/lib/browser/view/debug-view-model';
import { DebugVariablesModelService } from '@opensumi/ide-debug/lib/browser/view/variables/debug-variables-tree.model.service';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import styles from '../../../../src/browser/view/variables/debug-variables.module.less';

import { DebugContextKey } from './../../../../src/browser/contextkeys/debug-contextkey.service';

describe('Debug Variables Tree Model', () => {
  const mockInjector = createBrowserInjector([]);
  let debugVariablesModelService: DebugVariablesModelService;
  let viewModelChangeListener: (() => void | Promise<void>) | undefined;
  let variableChangeListener: (() => void | Promise<void>) | undefined;
  const mockDebugHoverSource = {
    onDidChange: jest.fn(() => Disposable.create(() => {})),
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
    ensureLoaded: jest.fn(),
  } as any;

  const mockDebugSessionManager = {
    onDidDestroyDebugSession: jest.fn(() => Disposable.create(() => {})),
    onDidChangeActiveDebugSession: jest.fn(() => Disposable.create(() => {})),
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

  const mockDebugViewModel = {
    currentSession: undefined as any,
    onDidChange: jest.fn((listener) => {
      viewModelChangeListener = listener;
      return Disposable.create(() => {});
    }),
  };

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
      token: DebugViewModel,
      useValue: mockDebugViewModel,
    });
    mockInjector.overrideProviders({
      token: DebugContextKey,
      useValue: {
        contextVariableEvaluateNamePresent: {
          set: jest.fn(),
        },
        contextDebugProtocolVariableMenu: {
          set: jest.fn(),
        },
        contextCanViewMemory: {
          set: jest.fn(),
        },
      },
    });

    debugVariablesModelService = mockInjector.get(DebugVariablesModelService);
  });

  afterAll(() => {
    debugVariablesModelService.dispose();
  });

  it('should have enough API', () => {
    expect(typeof debugVariablesModelService.listenTreeViewChange).toBe('function');
    expect(typeof debugVariablesModelService.dispose).toBe('function');
    expect(typeof debugVariablesModelService.onDidUpdateTreeModel).toBe('function');
    expect(typeof debugVariablesModelService.initTreeModel).toBe('function');
    expect(typeof debugVariablesModelService.refresh).toBe('function');
    expect(typeof debugVariablesModelService.initDecorations).toBe('function');
    expect(typeof debugVariablesModelService.activeNodeDecoration).toBe('function');
    expect(typeof debugVariablesModelService.activeNodeActivedDecoration).toBe('function');
    expect(typeof debugVariablesModelService.enactiveNodeDecoration).toBe('function');
    expect(typeof debugVariablesModelService.removeNodeDecoration).toBe('function');
    expect(typeof debugVariablesModelService.handleTreeHandler).toBe('function');
    expect(typeof debugVariablesModelService.handleTreeBlur).toBe('function');
    expect(typeof debugVariablesModelService.handleTwistierClick).toBe('function');
    expect(typeof debugVariablesModelService.toggleDirectory).toBe('function');
    expect(debugVariablesModelService.flushEventQueuePromise).toBeUndefined();
    expect(debugVariablesModelService.treeHandle).toBeUndefined();
    expect(debugVariablesModelService.decorations).toBeUndefined();
    expect(debugVariablesModelService.treeModel).toBeUndefined();
    expect(debugVariablesModelService.focusedNode).toBeUndefined();
    expect(Array.isArray(debugVariablesModelService.selectedNodes)).toBeTruthy();
  });

  it('should init success', () => {
    expect(mockDebugViewModel.onDidChange).toHaveBeenCalledTimes(1);
  });

  it('refreshes when current session variables change', async () => {
    const mockSession = {
      on: jest.fn(),
      onVariableChange: jest.fn((listener) => {
        variableChangeListener = listener;
        return Disposable.create(() => {});
      }),
    } as any;
    const refreshSpy = jest.spyOn(debugVariablesModelService, 'refresh').mockResolvedValue();

    mockDebugViewModel.currentSession = mockSession;
    await viewModelChangeListener?.();
    await variableChangeListener?.();

    expect(mockSession.onVariableChange).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    refreshSpy.mockRestore();
  });

  it('does not refresh a stale tree when session changes before the new tree is ready', async () => {
    jest.useFakeTimers();
    try {
      let currentVariableChangeListener: (() => void | Promise<void>) | undefined;
      const oldSession = {
        id: 'old-session',
        terminated: false,
        onVariableChange: jest.fn(() => Disposable.create(() => {})),
      } as any;
      const newSession = {
        id: 'new-session',
        terminated: false,
        onVariableChange: jest.fn((listener) => {
          currentVariableChangeListener = listener;
          return Disposable.create(() => {});
        }),
      } as any;
      const oldWatcher = {
        callback: jest.fn(async () => {}),
      };

      (debugVariablesModelService as any)._activeTreeModel = {
        root: {
          session: oldSession,
          path: '/oldRoot',
          children: [],
          watchEvents: new Map([['/oldRoot', oldWatcher]]),
        },
      };
      (debugVariablesModelService as any).currentSession = oldSession;
      mockDebugViewModel.currentSession = newSession;
      (debugVariablesModelService as any).listenCurrentSessionVariableChange();

      await currentVariableChangeListener?.();
      await jest.advanceTimersByTimeAsync(100);

      expect(oldWatcher.callback).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not refresh when the subscribed session is terminated', async () => {
    jest.useFakeTimers();
    try {
      let currentVariableChangeListener: (() => void | Promise<void>) | undefined;
      const session = {
        id: 'terminated-session',
        terminated: true,
        onVariableChange: jest.fn((listener) => {
          currentVariableChangeListener = listener;
          return Disposable.create(() => {});
        }),
      } as any;
      const watcher = {
        callback: jest.fn(async () => {}),
      };

      (debugVariablesModelService as any)._activeTreeModel = {
        root: {
          session,
          path: '/terminatedRoot',
          children: [],
          watchEvents: new Map([['/terminatedRoot', watcher]]),
        },
      };
      (debugVariablesModelService as any).currentSession = undefined;
      mockDebugViewModel.currentSession = session;
      (debugVariablesModelService as any).listenCurrentSessionVariableChange();

      await currentVariableChangeListener?.();
      await jest.advanceTimersByTimeAsync(100);

      expect(watcher.callback).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('recreates tree listener collection after disposing old listeners', () => {
    const previousCollection = (debugVariablesModelService as any).disposableCollection;

    debugVariablesModelService.initDecorations(mockRoot);
    (debugVariablesModelService as any)._activeTreeModel = {
      root: mockRoot,
    };
    debugVariablesModelService.listenTreeViewChange();

    expect((debugVariablesModelService as any).disposableCollection).not.toBe(previousCollection);
  });

  it('waits for queued watcher refresh before resolving refresh', async () => {
    jest.useFakeTimers();
    try {
      const watcherDeferred = new Deferred<void>();
      const watcher = {
        callback: jest.fn(() => watcherDeferred.promise),
      };
      const root = {
        path: '/testRoot',
        children: [],
        watchEvents: new Map([['/testRoot', watcher]]),
      };
      const refreshed = jest.fn();
      let refreshResolved = false;

      (debugVariablesModelService as any)._activeTreeModel = {
        root,
      };
      debugVariablesModelService.onDidRefreshed(refreshed);

      const refreshPromise = debugVariablesModelService.refresh(root as any).then(() => {
        refreshResolved = true;
      });
      await Promise.resolve();

      expect(refreshResolved).toBe(false);

      await jest.advanceTimersByTimeAsync(100);
      expect(watcher.callback).toHaveBeenCalledTimes(1);
      expect(refreshResolved).toBe(false);

      watcherDeferred.resolve();
      await refreshPromise;

      expect(refreshed).toHaveBeenCalledTimes(1);
      expect(refreshResolved).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels pending queued refresh work when disposed', async () => {
    jest.useFakeTimers();
    try {
      const watcher = {
        callback: jest.fn(async () => {}),
      };
      const root = {
        path: '/disposeRoot',
        children: [],
        watchEvents: new Map([['/disposeRoot', watcher]]),
      };
      const refreshed = jest.fn();

      (debugVariablesModelService as any)._activeTreeModel = {
        root,
      };
      debugVariablesModelService.onDidRefreshed(refreshed);

      const refreshPromise = debugVariablesModelService.refresh(root as any);
      await Promise.resolve();

      debugVariablesModelService.dispose();

      expect(debugVariablesModelService.flushEventQueuePromise).toBeFalsy();

      await jest.advanceTimersByTimeAsync(100);
      await refreshPromise;

      expect(watcher.callback).not.toHaveBeenCalled();
      expect(refreshed).not.toHaveBeenCalled();
    } finally {
      (debugVariablesModelService as any)._disposed = false;
      jest.useRealTimers();
    }
  });

  it('queues another flush when a refresh arrives during an active flush', async () => {
    jest.useFakeTimers();
    try {
      const flushDeferred = new Deferred<void>();
      const fooWatcher = {
        callback: jest.fn(() => flushDeferred.promise),
      };
      const barWatcher = {
        callback: jest.fn(async () => {}),
      };

      (debugVariablesModelService as any)._activeTreeModel = {
        root: {
          watchEvents: new Map([
            ['/testRoot/foo', fooWatcher],
            ['/testRoot/bar', barWatcher],
          ]),
        },
      };

      (debugVariablesModelService as any).queueChangeEvent('/testRoot/foo', jest.fn());
      await jest.advanceTimersByTimeAsync(100);
      expect(fooWatcher.callback).toHaveBeenCalledTimes(1);

      (debugVariablesModelService as any).queueChangeEvent('/testRoot/bar', jest.fn());
      flushDeferred.resolve();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(100);

      expect(barWatcher.callback).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves queued callbacks if flushEventQueue is called during an active flush', async () => {
    jest.useFakeTimers();
    try {
      const flushDeferred = new Deferred<void>();
      const fooWatcher = {
        callback: jest.fn(() => flushDeferred.promise),
      };
      const barWatcher = {
        callback: jest.fn(async () => {}),
      };
      const barCallback = jest.fn();

      (debugVariablesModelService as any)._activeTreeModel = {
        root: {
          watchEvents: new Map([
            ['/testRoot/foo', fooWatcher],
            ['/testRoot/bar', barWatcher],
          ]),
        },
      };

      (debugVariablesModelService as any).queueChangeEvent('/testRoot/foo', jest.fn());
      await jest.advanceTimersByTimeAsync(100);
      expect(fooWatcher.callback).toHaveBeenCalledTimes(1);

      (debugVariablesModelService as any).queueChangeEvent('/testRoot/bar', barCallback);
      await debugVariablesModelService.flushEventQueue();
      flushDeferred.resolve();
      await jest.advanceTimersByTimeAsync(100);

      expect(barWatcher.callback).toHaveBeenCalledTimes(1);
      expect(barCallback).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not dedupe sibling paths that only share a string prefix', async () => {
    const fooWatcher = {
      callback: jest.fn(async () => {}),
    };
    const foobarWatcher = {
      callback: jest.fn(async () => {}),
    };

    (debugVariablesModelService as any)._activeTreeModel = {
      root: {
        watchEvents: new Map([
          ['/testRoot/foo', fooWatcher],
          ['/testRoot/foobar', foobarWatcher],
        ]),
      },
    };
    (debugVariablesModelService as any)._changeEventDispatchQueue = ['/testRoot/foo', '/testRoot/foobar'];

    await debugVariablesModelService.flushEventQueue();

    expect(fooWatcher.callback).toHaveBeenCalledTimes(1);
    expect(foobarWatcher.callback).toHaveBeenCalledTimes(1);
  });

  it('restores expanded Locals and Globals from cached scope state', async () => {
    const localsRawScope = { name: 'Locals', expensive: false };
    const globalsRawScope = { name: 'Globals', expensive: false };
    const oldLocalsScope = {
      expanded: true,
      variablesReference: 1,
      getRawScope: () => localsRawScope,
    };
    const oldGlobalsScope = {
      expanded: true,
      variablesReference: 2,
      getRawScope: () => globalsRawScope,
    };
    const refreshedLocalsScope = {
      expanded: false,
      variablesReference: 101,
      children: [],
      setExpanded: jest.fn(async () => {
        refreshedLocalsScope.expanded = true;
      }),
      getRawScope: () => ({ name: 'Locals', expensive: false }),
    };
    const refreshedGlobalsScope = {
      expanded: false,
      variablesReference: 102,
      children: [],
      setExpanded: jest.fn(async () => {
        refreshedGlobalsScope.expanded = true;
      }),
      getRawScope: () => ({ name: 'Globals', expensive: false }),
    };
    const refreshedClosureScope = {
      expanded: false,
      variablesReference: 103,
      children: [],
      setExpanded: jest.fn(async () => {
        refreshedClosureScope.expanded = true;
      }),
      getRawScope: () => ({ name: 'Closure', expensive: false }),
    };

    (debugVariablesModelService as any).keepExpandedScopesModel.set(oldLocalsScope);
    (debugVariablesModelService as any).keepExpandedScopesModel.set(oldGlobalsScope);

    await (debugVariablesModelService as any).restoreExpandedScopes([
      refreshedLocalsScope,
      refreshedGlobalsScope,
      refreshedClosureScope,
    ]);

    expect(refreshedLocalsScope.setExpanded).toHaveBeenCalledTimes(1);
    expect(refreshedGlobalsScope.setExpanded).toHaveBeenCalledTimes(1);
    expect(refreshedClosureScope.setExpanded).not.toHaveBeenCalled();
  });

  it('initTreeModel method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugVariablesModelService.initTreeModel(mockSession);
    expect(debugVariablesModelService.treeModel).toBeDefined();
  });

  it('activeNodeDecoration method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugVariablesModelService.initDecorations(mockRoot);
    const node = new DebugConsoleNode({ session: mockSession }, 'test', mockRoot);
    debugVariablesModelService.activeNodeDecoration(node);
    const decoration = debugVariablesModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
  });

  it('enactiveNodeDecoration method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugVariablesModelService.initDecorations(mockRoot);
    const node = new DebugConsoleNode({ session: mockSession }, 'test', mockRoot);
    debugVariablesModelService.activeNodeDecoration(node);
    let decoration = debugVariablesModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    debugVariablesModelService.enactiveNodeDecoration();
    decoration = debugVariablesModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('removeNodeDecoration method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugVariablesModelService.initDecorations(mockRoot);
    const node = new DebugConsoleNode({ session: mockSession }, 'test', mockRoot);
    debugVariablesModelService.activeNodeDecoration(node);
    let decoration = debugVariablesModelService.decorations.getDecorations(node);
    debugVariablesModelService.removeNodeDecoration();
    decoration = debugVariablesModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([]);
  });

  it('handleTreeHandler method should be work', () => {
    const treeHandle = { ensureVisible: () => {}, getModel: () => debugVariablesModelService.treeModel! } as any;
    debugVariablesModelService.handleTreeHandler(treeHandle);
    expect(debugVariablesModelService.treeHandle.getModel()).toEqual(treeHandle.getModel());
  });

  it('handleTreeBlur method should be work', () => {
    const mockSession = {
      on: jest.fn(),
    } as any;
    debugVariablesModelService.initDecorations(mockRoot);
    const node = new DebugConsoleNode({ session: mockSession }, 'test', mockRoot);
    debugVariablesModelService.initDecorations(mockRoot);
    debugVariablesModelService.activeNodeDecoration(node);
    let decoration = debugVariablesModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
    debugVariablesModelService.handleTreeBlur();
    decoration = debugVariablesModelService.decorations.getDecorations(node);
    expect(decoration).toBeDefined();
    expect(decoration!.classlist).toEqual([styles.mod_selected]);
  });

  it('handleTwistierClick method should be work', () => {
    const treeHandle = { collapseNode: jest.fn(), expandNode: jest.fn() } as any;
    let mockNode = { expanded: false, setExpanded: () => {}, setCollapsed: () => {}, getRawScope: () => {} };
    debugVariablesModelService.handleTreeHandler(treeHandle);
    debugVariablesModelService.toggleDirectory(mockNode as any);
    expect(treeHandle.expandNode).toHaveBeenCalledTimes(0);
    mockNode = { expanded: true, setExpanded: () => {}, setCollapsed: () => {}, getRawScope: () => {} };
    debugVariablesModelService.toggleDirectory(mockNode as any);
    expect(treeHandle.collapseNode).toHaveBeenCalledTimes(0);
  });

  it('handleContextMenu method should be work', () => {
    const mockNode = { expanded: false, toDebugProtocolObject: jest.fn() } as any;
    const mockEvent = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
      nativeEvent: {
        x: 1,
        y: 1,
      },
    } as any;
    debugVariablesModelService.handleContextMenu(mockEvent, mockNode);
    expect(mockCtxMenuRenderer.show).toHaveBeenCalledTimes(1);
    expect(mockEvent.stopPropagation).toHaveBeenCalledTimes(1);
    expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
  });
});
