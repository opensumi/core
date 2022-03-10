import { IContextKeyService } from '@opensumi/ide-core-browser';
import { Disposable, URI, IFileServiceClient, IEventBus, EventBusImpl } from '@opensumi/ide-core-common';
import { IDebugSessionManager } from '@opensumi/ide-debug';
import { BreakpointManager, DebugBreakpoint } from '@opensumi/ide-debug/lib/browser';
import { DebugBreakpointsService } from '@opensumi/ide-debug/lib/browser/view/breakpoints/debug-breakpoints.service';
import { DebugViewModel } from '@opensumi/ide-debug/lib/browser/view/debug-view-model';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { MockFileServiceClient } from '@opensumi/ide-file-service/lib/common/mocks';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceEditDidRenameFileEvent, WorkspaceEditDidDeleteFileEvent } from '@opensumi/ide-workspace-edit';
import { IWorkspaceStorageService } from '@opensumi/ide-workspace/lib/common/workspace-defination';

describe('Debug Breakpoints Service', () => {
  const mockInjector = createBrowserInjector(
    [],
    new MockInjector([
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

  it('should init success', () => {
    expect(mockBreakpointManager.onDidChangeBreakpoints).toBeCalledTimes(1);
    expect(mockBreakpointManager.onDidChangeExceptionsBreakpoints).toBeCalledTimes(1);
    expect(mockContextKeyService.onDidChangeContext).toBeCalledTimes(1);
    expect(mockWorkspaceService.onWorkspaceChanged).toBeCalledTimes(1);
  });

  it('updateRoots method should be work', async (done) => {
    await debugBreakpointsService.updateRoots();
    done();
  });

  it('toggleBreakpointEnable method should be work', async (done) => {
    // DebugBreakpoint
    const breakpoint = DebugBreakpoint.create(URI.file('test.js'), { line: 1 });
    mockBreakpointManager.getBreakpoint.mockReturnValueOnce(breakpoint as any);
    await debugBreakpointsService.toggleBreakpointEnable(breakpoint);
    expect(mockBreakpointManager.updateBreakpoint).toBeCalledTimes(1);
    // DebugExceptionBreakpoint
    const exceptionBreakpoint = { filter: 'test' };
    await debugBreakpointsService.toggleBreakpointEnable(exceptionBreakpoint as any);
    expect(mockBreakpointManager.updateExceptionBreakpoints).toBeCalledTimes(1);
    done();
  });

  it('extractNodes method should be work', () => {
    const breakpoint = DebugBreakpoint.create(URI.file('test.js'), { line: 1 });
    const exceptionBreakpoint = { filter: 'test' };
    const items = [breakpoint, exceptionBreakpoint];
    const nodes = debugBreakpointsService.extractNodes(items as any);
    expect(nodes.length).toBe(2);
  });

  it('removeAllBreakpoints method should be work', () => {
    debugBreakpointsService.removeAllBreakpoints();
    expect(mockBreakpointManager.clearBreakpoints).toBeCalledTimes(1);
  });

  it('toggleBreakpoints method should be work', () => {
    expect(debugBreakpointsService.enable).toBeFalsy();
    debugBreakpointsService.toggleBreakpoints();
    expect(debugBreakpointsService.enable).toBeTruthy();
  });

  it('onRenameFile should be work', async (done) => {
    await eventBus.fireAndAwait(new WorkspaceEditDidRenameFileEvent({ oldUri: URI.file('test.js') } as any));
    expect(mockBreakpointManager.cleanAllMarkers).toBeCalledTimes(1);
    done();
  });

  it('onDeleteFile should be work', async (done) => {
    await eventBus.fireAndAwait(new WorkspaceEditDidDeleteFileEvent({ oldUri: URI.file('test.js') } as any));
    expect(mockBreakpointManager.cleanAllMarkers).toBeCalledTimes(2);
    done();
  });
});
