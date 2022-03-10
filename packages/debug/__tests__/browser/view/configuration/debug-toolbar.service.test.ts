import { IEventBus, EventBusImpl } from '@opensumi/ide-core-common';
import { DebugToolbarService } from '@opensumi/ide-debug/lib/browser/view/configuration/debug-toolbar.service';
import { DebugViewModel } from '@opensumi/ide-debug/lib/browser/view/debug-view-model';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

describe('Debug Configuration Service', () => {
  const mockInjector = createBrowserInjector(
    [],
    new MockInjector([
      {
        token: IEventBus,
        useClass: EventBusImpl,
      },
    ]),
  );
  let debugToolbarService: DebugToolbarService;

  const mockDebugViewModel = {
    onDidChange: jest.fn(),
    sessions: [],
    currentSession: {
      id: 'URBBRGROUN',
      terminate: jest.fn(),
    },
    currentThread: {
      continue: jest.fn(),
      pause: jest.fn(),
      stepOver: jest.fn(),
      stepIn: jest.fn(),
      stepOut: jest.fn(),
    },
    start: jest.fn(),
    restart: jest.fn(),
    report: jest.fn(),
    reportTime: jest.fn(() => () => {}),
    reportAction: jest.fn(),
  };

  beforeAll(async () => {
    mockInjector.overrideProviders({
      token: DebugToolbarService,
      useClass: DebugToolbarService,
    });
    mockInjector.overrideProviders({
      token: DebugViewModel,
      useValue: mockDebugViewModel,
    });
    debugToolbarService = mockInjector.get(DebugToolbarService);
  });

  it('should have enough API', () => {
    expect(typeof debugToolbarService.updateModel).toBe('function');
    expect(typeof debugToolbarService.updateToolBarMenu).toBe('function');
    expect(typeof debugToolbarService.doStart).toBe('function');
    expect(typeof debugToolbarService.doRestart).toBe('function');
    expect(typeof debugToolbarService.doStop).toBe('function');
    expect(typeof debugToolbarService.doContinue).toBe('function');
    expect(typeof debugToolbarService.doPause).toBe('function');
    expect(typeof debugToolbarService.doStepOver).toBe('function');
    expect(typeof debugToolbarService.doStepIn).toBe('function');
    expect(typeof debugToolbarService.doStepOut).toBe('function');
    expect(typeof debugToolbarService.updateCurrentSession).toBe('function');
    expect(typeof debugToolbarService.toolBarMenuMap).toBe('object');
    expect(Array.isArray(debugToolbarService.sessions)).toBeTruthy();
    expect(debugToolbarService.currentSession).toBeUndefined();
  });

  it('should init success', () => {
    expect(mockDebugViewModel.onDidChange).toBeCalledTimes(1);
  });

  it('onStart method should be work', () => {
    debugToolbarService.doStart();
    expect(mockDebugViewModel.start).toBeCalledTimes(1);
  });

  it('doRestart method should be work', async () => {
    await debugToolbarService.doRestart();
    expect(mockDebugViewModel.restart).toBeCalledTimes(1);
  });

  it('doStop method should be work', async () => {
    await debugToolbarService.doStop();
    expect(mockDebugViewModel.currentSession.terminate).toBeCalledTimes(1);
  });

  it('doContinue method should be work', async () => {
    await debugToolbarService.doContinue();
    expect(mockDebugViewModel.currentThread.continue).toBeCalledTimes(1);
  });

  it('doPause method should be work', async () => {
    await debugToolbarService.doPause();
    expect(mockDebugViewModel.currentThread.pause).toBeCalledTimes(1);
  });

  it('doStepIn method should be work', async () => {
    await debugToolbarService.doStepIn();
    expect(mockDebugViewModel.currentThread.stepIn).toBeCalledTimes(1);
  });

  it('doStepOver method should be work', async () => {
    await debugToolbarService.doStepOver();
    expect(mockDebugViewModel.currentThread.stepOver).toBeCalledTimes(1);
  });

  it('doStepOut method should be work', async () => {
    await debugToolbarService.doStepOut();
    expect(mockDebugViewModel.currentThread.stepOut).toBeCalledTimes(1);
  });

  it('updateCurrentSession method should be work', () => {
    const session = {} as any;
    debugToolbarService.updateCurrentSession(session);
    debugToolbarService.updateModel();
    expect(debugToolbarService.currentSession).toEqual(session);
  });

  it('updateModel method should be work', () => {
    debugToolbarService.updateModel();
    expect(debugToolbarService.sessionCount).toBe(0);
  });

  it('updateToolBarMenu method should be work', () => {
    debugToolbarService.updateModel();
    debugToolbarService.updateToolBarMenu();
    expect(debugToolbarService.toolBarMenuMap.size).toBeGreaterThanOrEqual(0);
  });
});
