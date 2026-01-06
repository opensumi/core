import { Emitter, IContextKeyService, IReporterService, LabelService } from '@opensumi/ide-core-browser';
import { IDebugModelManager, IDebugProgress, IDebugServer, IDebugSessionManager } from '@opensumi/ide-debug';
import { BreakpointManager } from '@opensumi/ide-debug/lib/browser/breakpoint';
import {
  DebugSessionContributionRegistry,
  DebugSessionFactory,
} from '@opensumi/ide-debug/lib/browser/debug-session-contribution';
import { DebugSessionManager } from '@opensumi/ide-debug/lib/browser/debug-session-manager';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IMessageService } from '@opensumi/ide-overlay';
import { ITaskService } from '@opensumi/ide-task';
import { IVariableResolverService } from '@opensumi/ide-variable';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { MockDebugSession } from '../../__mocks__/debug-session';

describe('DebugSessionManager', () => {
  let debugSessionManager: IDebugSessionManager;
  let injector: MockInjector;

  const mockReporterServiceTimeEnd = jest.fn();
  const mockReporterService = {
    point: jest.fn(),
    time: jest.fn(() => ({
      timeEnd: mockReporterServiceTimeEnd,
    })),
  };

  const debugModelChangeEmitter: Emitter<any> = new Emitter();
  const mockDebugModelManager = {
    onModelChanged: debugModelChangeEmitter.event,
  };

  const mockVariableResolverService = {
    resolve: jest.fn((config) => config),
  };
  const sessionId = 10001;
  const mockDebugServer = {
    resolveDebugConfiguration: jest.fn((config) => config),
    resolveDebugConfigurationWithSubstitutedVariables: jest.fn((config) => config),
    createDebugSession: jest.fn(() => sessionId),
    terminateDebugSession: jest.fn(),
  };

  const mockTaskService = {
    getTask: jest.fn(() => ({ task: 'yarn run build' })),
    run: jest.fn(() => ({ exitCode: 200 })),
  };

  const mockDebugSessionContributionRegistry = {
    get: () => ({
      debugSessionFactory: () => ({
        get: () => new MockDebugSession(),
      }),
    }),
  };

  const mockDebugSessionFactory = {
    get: jest.fn(() => new MockDebugSession()),
  };

  const mockBreakpointManager = {
    getBreakpoints: jest.fn(() => []),
  };

  const mockMessageService = {
    error: jest.fn(),
  };

  beforeAll(() => {
    injector = createBrowserInjector(
      [],
      new MockInjector([
        {
          token: IContextKeyService,
          useClass: MockContextKeyService,
        },
        {
          token: IDebugModelManager,
          useValue: mockDebugModelManager,
        },
        {
          token: IReporterService,
          useValue: mockReporterService,
        },
        {
          token: LabelService,
          useValue: {},
        },
        {
          token: DebugSessionContributionRegistry,
          useValue: mockDebugSessionContributionRegistry,
        },
        {
          token: DebugSessionFactory,
          useValue: mockDebugSessionFactory,
        },
        {
          token: IDebugServer,
          useValue: mockDebugServer,
        },
        {
          token: WorkbenchEditorService,
          useValue: {},
        },
        {
          token: IMessageService,
          useValue: mockMessageService,
        },
        {
          token: IVariableResolverService,
          useValue: mockVariableResolverService,
        },
        {
          token: BreakpointManager,
          useValue: mockBreakpointManager,
        },
        {
          token: ITaskService,
          useValue: mockTaskService,
        },
        {
          token: IDebugSessionManager,
          useClass: DebugSessionManager,
        },
        {
          token: IDebugProgress,
          useValue: {
            onDebugServiceStateChange: jest.fn(),
          },
        },
      ]),
    );
    debugSessionManager = injector.get(IDebugSessionManager);
  });

  afterAll(async () => {
    await injector.disposeAll();
  });

  it('report start action time', () => {
    const report = debugSessionManager.reportTime('debug-time-tracker');
    debugSessionManager.reportAction('1001', '10001', 'start');
    const message = 'tracker message';
    report(message);
    expect(mockReporterService.time).toHaveBeenCalledTimes(1);
    expect(mockReporterServiceTimeEnd).toHaveBeenCalledTimes(1);
    mockReporterService.time.mockClear();
  });

  it('start a new debug session with preLaunchTask', async () => {
    const configuration = {
      type: 'node',
      request: 'attach',
      name: 'Attach to BackEnd',
      port: 9999,
      restart: true,
      preLaunchTask: 'build',
    };
    await debugSessionManager.start({ configuration });
    expect(mockDebugServer.createDebugSession).toHaveBeenCalledTimes(1);
    expect(mockDebugServer.resolveDebugConfiguration).toHaveBeenCalledTimes(1);
    expect(mockDebugServer.resolveDebugConfigurationWithSubstitutedVariables).toHaveBeenCalledTimes(1);
    expect(mockVariableResolverService.resolve).toHaveBeenCalledTimes(1);
    expect(mockTaskService.getTask).toHaveBeenCalledTimes(1);
    expect(mockTaskService.run).toHaveBeenCalledTimes(1);
  });

  it('destroy session when start fails', async () => {
    const configuration = {
      type: 'node',
      request: 'launch',
      name: 'Failing Session',
    };
    const onDidChangeEmitter = new Emitter<void>();
    const onDidCustomEventEmitter = new Emitter<any>();
    const failingSession = {
      id: sessionId,
      configuration,
      capabilities: {},
      state: 0,
      terminated: false,
      onDidChange: onDidChangeEmitter.event,
      onDidCustomEvent: onDidCustomEventEmitter.event,
      on: jest.fn(() => ({ dispose: jest.fn() })),
      onCurrentThreadChange: jest.fn(() => ({ dispose: jest.fn() })),
      start: jest.fn(async () => {
        throw new Error('start failed');
      }),
      dispose: jest.fn(),
    } as any;
    const originalGet = mockDebugSessionContributionRegistry.get;
    mockDebugSessionContributionRegistry.get = () => ({
      debugSessionFactory: () => ({
        get: () => failingSession,
      }),
    });
    mockDebugServer.terminateDebugSession.mockClear();

    await debugSessionManager.start({ configuration });
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockDebugServer.terminateDebugSession).toHaveBeenCalledTimes(1);
    expect(mockDebugServer.terminateDebugSession).toHaveBeenCalledWith(sessionId);

    mockDebugSessionContributionRegistry.get = originalGet;
  });

  it('destroy debug session', async () => {
    mockDebugServer.terminateDebugSession.mockClear();
    const configuration = {
      type: 'node',
      request: 'launch',
      name: 'Destroy Session',
    };
    await debugSessionManager.start({ configuration });

    const destroyPromise = new Promise<void>((resolve) => {
      debugSessionManager.onDidDestroyDebugSession(() => {
        resolve();
      });
    });
    debugSessionManager.destroy(sessionId);
    await destroyPromise;
    expect(mockDebugServer.terminateDebugSession).toHaveBeenCalledTimes(1);
  });
});
