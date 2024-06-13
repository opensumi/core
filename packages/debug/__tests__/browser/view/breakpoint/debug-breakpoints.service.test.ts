import { IContextKeyService } from '@opensumi/ide-core-browser';
import { Disposable, EventBusImpl, IEventBus, IFileServiceClient, URI } from '@opensumi/ide-core-common';
import { IDebugSessionManager } from '@opensumi/ide-debug';
import {
  BreakpointManager,
  DebugBreakpoint,
  DebugExceptionBreakpoint,
} from '@opensumi/ide-debug/lib/browser/breakpoint';
import { DebugBreakpointsService } from '@opensumi/ide-debug/lib/browser/view/breakpoints/debug-breakpoints.service';
import { DebugViewModel } from '@opensumi/ide-debug/lib/browser/view/debug-view-model';
import { createBrowserInjector, getBrowserMockInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { MockFileServiceClient } from '@opensumi/ide-file-service/__mocks__/file-service-client';
import { IWorkspaceService, IWorkspaceStorageService } from '@opensumi/ide-workspace';
import { WorkspaceEditDidDeleteFileEvent, WorkspaceEditDidRenameFileEvent } from '@opensumi/ide-workspace-edit';

describe('Debug Breakpoints Service', () => {
  const mockInjector = createBrowserInjector(
    [],
    getBrowserMockInjector([
      {
        token: IEventBus,
        useClass: EventBusImpl,
      },
    ]),
  );
  let debugBreakpointsService: DebugBreakpointsService;
  let eventBus: IEventBus;

  const mockDebugSessionManager = {
    onDidDestroyDebugSession: jest.fn(() => Disposable.create(() => {})),
    onDidChangeActiveDebugSession: jest.fn(() => Disposable.create(() => {})),
  };

  const mockBreakpointManager = {
    onDidChangeBreakpoints: jest.fn(() => Disposable.create(() => {})),
    onDidChangeExceptionsBreakpoints: jest.fn(() => Disposable.create(() => {})),
    clearBreakpoints: jest.fn(),
    breakpointsEnabled: false,
    getExceptionBreakpoints: jest.fn(() => []),
    getBreakpoint: jest.fn(() => null),
    getBreakpoints: jest.fn(() => []),
    updateBreakpoint: jest.fn(),
    updateExceptionBreakpoints: jest.fn(),
    cleanAllMarkers: jest.fn(),
    whenReady: Promise.resolve(),
  };

  const mockContextKeyService = {
    onDidChangeContext: jest.fn(),
    getContextValue: () => true,
  };

  const mockDebugViewModel = {
    onDidChange: jest.fn(),
  };

  const mockWorkspaceService = {
    roots: [],
    onWorkspaceChanged: jest.fn(),
  };

  beforeAll(() => {
    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: mockDebugSessionManager,
    });
    mockInjector.overrideProviders({
      token: BreakpointManager,
      useValue: mockBreakpointManager,
    });
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: mockContextKeyService,
    });
    mockInjector.overrideProviders({
      token: IWorkspaceService,
      useValue: mockWorkspaceService,
    });
    mockInjector.overrideProviders({
      token: DebugViewModel,
      useValue: mockDebugViewModel,
    });
    mockInjector.overrideProviders({
      token: IFileServiceClient,
      useValue: MockFileServiceClient,
    });
    mockInjector.overrideProviders({
      token: IWorkspaceStorageService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IEditorDocumentModelService,
      useValue: {},
    });

    debugBreakpointsService = mockInjector.get(DebugBreakpointsService);
    eventBus = mockInjector.get(IEventBus);
  });

  afterAll(() => {
    debugBreakpointsService.dispose();
  });

  it('should have enough API', () => {
    expect(typeof debugBreakpointsService.init).toBe('function');
    expect(typeof debugBreakpointsService.updateRoots).toBe('function');
    expect(typeof debugBreakpointsService.toggleBreakpointEnable).toBe('function');
    expect(typeof debugBreakpointsService.extractNodes).toBe('function');
    expect(typeof debugBreakpointsService.removeAllBreakpoints).toBe('function');
    expect(typeof debugBreakpointsService.toggleBreakpoints).toBe('function');
  });

  it('should init success', async () => {
    expect(mockBreakpointManager.onDidChangeBreakpoints).toHaveBeenCalledTimes(1);
    expect(mockBreakpointManager.onDidChangeExceptionsBreakpoints).toHaveBeenCalledTimes(1);
    expect(mockContextKeyService.onDidChangeContext).toHaveBeenCalledTimes(1);
    expect(mockWorkspaceService.onWorkspaceChanged).toHaveBeenCalledTimes(1);
  });

  it('updateRoots method should be work', async () => {
    await debugBreakpointsService.updateRoots();
  });

  it('toggleBreakpointEnable method should be work', async () => {
    // DebugBreakpoint
    const breakpoint = DebugBreakpoint.create(URI.file('test.js'), { line: 1 });
    mockBreakpointManager.getBreakpoint.mockReturnValueOnce(breakpoint as any);
    await debugBreakpointsService.toggleBreakpointEnable(breakpoint);
    expect(mockBreakpointManager.updateBreakpoint).toHaveBeenCalledTimes(1);
    // DebugExceptionBreakpoint
    const exceptionBreakpoint = { filter: 'test' };
    await debugBreakpointsService.toggleBreakpointEnable(exceptionBreakpoint as any);
    expect(mockBreakpointManager.updateExceptionBreakpoints).toHaveBeenCalledTimes(1);
  });

  it('extractNodes method should be work', () => {
    const breakpoint = DebugBreakpoint.create(URI.file('test.js'), { line: 1 });
    const exceptionBreakpoint: DebugExceptionBreakpoint = { filter: 'test', label: '' };
    const breakpointNode = debugBreakpointsService.extractNodes(breakpoint);
    expect(breakpointNode?.id).toBe(breakpoint.id);
    const exceptionNodes = debugBreakpointsService.extractNodes(exceptionBreakpoint);
    expect(exceptionNodes?.id).toBe(exceptionBreakpoint.filter);
  });

  it('removeAllBreakpoints method should be work', () => {
    debugBreakpointsService.removeAllBreakpoints();
    expect(mockBreakpointManager.clearBreakpoints).toHaveBeenCalledTimes(1);
  });

  it('toggleBreakpoints method should be work', () => {
    expect(debugBreakpointsService.enable).toBeFalsy();
    debugBreakpointsService.toggleBreakpoints();
    expect(debugBreakpointsService.enable).toBeTruthy();
  });

  it('onRenameFile should be work', async () => {
    await eventBus.fireAndAwait(new WorkspaceEditDidRenameFileEvent({ oldUri: URI.file('test.js') } as any));
    expect(mockBreakpointManager.cleanAllMarkers).toHaveBeenCalledTimes(1);
  });

  it('onDeleteFile should be work', async () => {
    await eventBus.fireAndAwait(new WorkspaceEditDidDeleteFileEvent({ oldUri: URI.file('test.js') } as any));
    expect(mockBreakpointManager.cleanAllMarkers).toHaveBeenCalledTimes(2);
  });
});
