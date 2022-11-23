import { Emitter, IContextKeyService, IReporterService, LabelService } from '@opensumi/ide-core-browser';
import { IDebugServer, IDebugSessionManager, IDebugProgress, IDebugModelManager } from '@opensumi/ide-debug';
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
    expect(mockReporterService.time).toBeCalledTimes(1);
    expect(mockReporterServiceTimeEnd).toBeCalledTimes(1);
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
    expect(mockDebugServer.createDebugSession).toBeCalledTimes(1);
    expect(mockDebugServer.resolveDebugConfiguration).toBeCalledTimes(1);
    expect(mockDebugServer.resolveDebugConfigurationWithSubstitutedVariables).toBeCalledTimes(1);
    expect(mockVariableResolverService.resolve).toBeCalledTimes(1);
    expect(mockTaskService.getTask).toBeCalledTimes(1);
    expect(mockTaskService.run).toBeCalledTimes(1);
  });

  it('destroy debug session', (done) => {
    debugSessionManager.onDidDestroyDebugSession(() => {
      done();
    });
    debugSessionManager.destroy(sessionId);
    expect(mockDebugServer.terminateDebugSession).toBeCalledTimes(1);
  });
});
