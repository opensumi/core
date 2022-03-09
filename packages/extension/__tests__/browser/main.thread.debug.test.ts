import { IRPCProtocol } from '@opensumi/ide-connection';
import { LabelService } from '@opensumi/ide-core-browser/src';
import { Disposable, IFileServiceClient, ILoggerManagerClient, URI, Uri } from '@opensumi/ide-core-common';
import { IDebugSessionManager, IDebugService, IDebugServer } from '@opensumi/ide-debug';
import {
  BreakpointManager,
  DebugPreferences,
  DebugSessionContributionRegistry,
  DebugModelManager,
} from '@opensumi/ide-debug/lib/browser';
import { DebugConfigurationManager } from '@opensumi/ide-debug/lib/browser';
import { DebugConsoleModelService } from '@opensumi/ide-debug/lib/browser/view/console/debug-console-tree.model.service';
import { WorkbenchEditorService } from '@opensumi/ide-editor/src';
import { MainThreadConnection } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.connection';
import { MainThreadDebug } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.debug';
import { ExtHostAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import { IMessageService } from '@opensumi/ide-overlay';
import { ITerminalApiService } from '@opensumi/ide-terminal-next';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

const map = new Map();

const rpcProtocol: IRPCProtocol = {
  getProxy: (key) => map.get(key),
  set: (key, value) => {
    map.set(key, value);
    return value;
  },
  get: (r) => map.get(r),
};

const mockExtThreadDebug = {
  $breakpointsDidChange: jest.fn(() => Disposable.create(() => {})),
  $sessionDidStart: jest.fn(() => Disposable.create(() => {})),
  $sessionDidDestroy: jest.fn(() => Disposable.create(() => {})),
  $sessionDidChange: jest.fn(() => Disposable.create(() => {})),
  $onSessionCustomEvent: jest.fn(() => Disposable.create(() => {})),
  $unregisterDebuggerContributions: jest.fn(() => Disposable.create(() => {})),
  $registerDebuggerContributions: jest.fn(() => Disposable.create(() => {})),
  $getTerminalCreationOptions: jest.fn(() => Disposable.create(() => {})),
};

const mockExtThreadConnection = {
  $createConnection: jest.fn(),
  $deleteConnection: jest.fn(),
  $sendMessage: jest.fn(),
};

const mockDebugSessionManager = {
  onDidStartDebugSession: jest.fn(() => Disposable.create(() => {})),
  onDidDestroyDebugSession: jest.fn(() => Disposable.create(() => {})),
  onDidChangeActiveDebugSession: jest.fn(() => Disposable.create(() => {})),
  onDidReceiveDebugSessionCustomEvent: jest.fn(() => Disposable.create(() => {})),
  getSession: jest.fn(),
  start: jest.fn(),
};

const mockDebugService = {
  debugContributionPoints: [
    [
      URI.file('/home/test').toString(),
      [
        {
          type: 'node',
          label: 'Node Debug',
        },
      ],
    ],
  ],
  onDidDebugContributionPointChange: jest.fn(() => Disposable.create(() => {})),
};

const mockDebugSessionContributionRegistry = {
  registerDebugSessionContribution: jest.fn(() => Disposable.create(() => {})),
};

const mockBreakpointManager = {
  onDidChangeBreakpoints: jest.fn(() => Disposable.create(() => {})),
  addBreakpoint: jest.fn(),
  findMarkers: jest.fn(),
  delBreakpoint: jest.fn(),
};

const mockDebugConsoleModelService = {
  debugConsoleSession: {
    append: jest.fn(),
    appendLine: jest.fn(),
  },
};

const mockDebugConfigurationManager = {
  all: [] as any,
};

const mockDebugServer = {
  registerDebugAdapterContribution: jest.fn(() => Disposable.create(() => {})),
};

const mockDebugModelManager = {
  resolve: jest.fn(),
};

describe('MainThreadDebug API Test Suite', () => {
  let injector: MockInjector;
  let mainThreadDebug: MainThreadDebug;
  let mainThreadConnection: MainThreadConnection;
  beforeAll(() => {
    jest.clearAllMocks();

    injector = createBrowserInjector(
      [],
      new MockInjector([
        {
          token: BreakpointManager,
          useValue: mockBreakpointManager,
        },
        {
          token: IDebugSessionManager,
          useValue: mockDebugSessionManager,
        },
        {
          token: DebugModelManager,
          useValue: mockDebugModelManager,
        },
        {
          token: IDebugService,
          useValue: mockDebugService,
        },
        {
          token: DebugConsoleModelService,
          useValue: mockDebugConsoleModelService,
        },
        {
          token: ITerminalApiService,
          useValue: {},
        },
        {
          token: WorkbenchEditorService,
          useValue: {},
        },
        {
          token: DebugSessionContributionRegistry,
          useValue: mockDebugSessionContributionRegistry,
        },
        {
          token: ILoggerManagerClient,
          useValue: {
            getLogger: () => ({
              log() {},
              debug() {},
              error() {},
              verbose() {},
              warn() {},
            }),
          },
        },
        {
          token: IMessageService,
          useValue: {},
        },
        {
          token: IFileServiceClient,
          useValue: {},
        },
        {
          token: DebugPreferences,
          useValue: {},
        },
        {
          token: LabelService,
          useValue: {},
        },
        {
          token: DebugConfigurationManager,
          useValue: mockDebugConfigurationManager,
        },
        {
          token: IDebugServer,
          useValue: mockDebugServer,
        },
      ]),
    );
    rpcProtocol.set(ExtHostAPIIdentifier.ExtHostConnection, mockExtThreadConnection as any);
    rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDebug, mockExtThreadDebug as any);

    mainThreadConnection = injector.get(MainThreadConnection, [rpcProtocol]);
    mainThreadDebug = injector.get(MainThreadDebug, [rpcProtocol, mainThreadConnection]);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('MainThreadDebug can be initial correctly', () => {
    expect(mockBreakpointManager.onDidChangeBreakpoints).toBeCalledTimes(1);
    expect(mockDebugSessionManager.onDidStartDebugSession).toBeCalledTimes(1);
    expect(mockDebugSessionManager.onDidDestroyDebugSession).toBeCalledTimes(1);
    expect(mockDebugSessionManager.onDidChangeActiveDebugSession).toBeCalledTimes(1);
    expect(mockDebugSessionManager.onDidReceiveDebugSessionCustomEvent).toBeCalledTimes(1);
    expect(mockDebugService.onDidDebugContributionPointChange).toBeCalledTimes(1);
    expect(mockDebugSessionManager.onDidStartDebugSession).toBeCalledTimes(1);
    expect(mockExtThreadDebug.$registerDebuggerContributions).toBeCalledTimes(1);
    mockExtThreadDebug.$getTerminalCreationOptions.mockClear();
  });

  it('$appendToDebugConsole method should be work', () => {
    const value = 'test';
    mainThreadDebug.$appendToDebugConsole(value);
    expect(mockDebugConsoleModelService.debugConsoleSession.append).toBeCalledWith(value);
  });

  it('$appendLineToDebugConsole method should be work', () => {
    const value = 'test';
    mainThreadDebug.$appendLineToDebugConsole(value);
    expect(mockDebugConsoleModelService.debugConsoleSession.appendLine).toBeCalledWith(value);
  });

  it('$registerDebuggerContribution method should be work', async () => {
    await mainThreadDebug.$registerDebuggerContribution({
      type: 'node',
      label: 'Node Debug',
    });
    expect(mockExtThreadDebug.$getTerminalCreationOptions).toBeCalledTimes(1);
    expect(mockDebugServer.registerDebugAdapterContribution).toBeCalledTimes(1);
    expect(mockDebugSessionContributionRegistry.registerDebugSessionContribution).toBeCalledTimes(1);
  });

  it('$addBreakpoints method should be work', async () => {
    const breakpoints = [
      {
        id: 1,
        enabled: true,
        location: {
          uri: Uri.parse('/home/a.js'),
          range: {
            startLineNumber: 1,
            startColumn: 0,
            endLineNumber: 1,
            endColumn: 10,
          },
        },
      },
    ];
    mockBreakpointManager.findMarkers.mockClear();
    await mainThreadDebug.$addBreakpoints(breakpoints as any);
    expect(mockBreakpointManager.addBreakpoint).toBeCalledTimes(1);
    expect(mockBreakpointManager.findMarkers).toBeCalledTimes(1);
  });

  it('$removeBreakpoints method should be work', async () => {
    const breakpoints = [
      {
        id: 1,
        enabled: true,
      },
    ];
    mockBreakpointManager.findMarkers.mockReturnValueOnce([
      {
        data: {
          uri: URI.file('/home/a.js').toString(),
        },
      },
    ]);
    mockBreakpointManager.findMarkers.mockClear();
    await mainThreadDebug.$removeBreakpoints(breakpoints as any);
    expect(mockBreakpointManager.findMarkers).toBeCalledTimes(1);
  });

  it('$customRequest method should be work', async () => {
    const sendCustomRequest = jest.fn();
    mockDebugSessionManager.getSession.mockReturnValueOnce({
      sendCustomRequest,
    });
    await mainThreadDebug.$customRequest('1', 'source');
    expect(sendCustomRequest).toBeCalledTimes(1);
  });

  it('$getDebugProtocolBreakpoint method should be work', async () => {
    const getDebugProtocolBreakpoint = jest.fn();
    mockDebugSessionManager.getSession.mockReturnValueOnce({
      getDebugProtocolBreakpoint,
    });
    await mainThreadDebug.$getDebugProtocolBreakpoint('1', '1');
    expect(getDebugProtocolBreakpoint).toBeCalledTimes(1);
  });

  it('$startDebugging method should be work', async () => {
    mockDebugConfigurationManager.all.push({
      configuration: {
        name: 'test',
        configuration: {},
      },
    });
    await mainThreadDebug.$startDebugging(undefined, 'test', {});
    expect(mockDebugSessionManager.start).toBeCalledTimes(1);
  });

  it('$unregisterDebuggerContribution method should be work', () => {
    mainThreadDebug.$unregisterDebuggerContribution({
      type: 'node',
      label: 'Node Debug',
    });
  });
});
