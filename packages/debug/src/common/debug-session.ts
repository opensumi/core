import { CancellationToken, IDisposable } from '@opensumi/ide-core-common';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { DebugConfiguration } from './debug-configuration';
import { DebugSessionOptions, IDebugSessionDTO } from './debug-session-options';

export enum DebugState {
  Inactive,
  Initializing,
  Running,
  Stopped,
}

export type IDebugSessionReplMode = 'separate' | 'mergeWithParent';

export interface IDebugSessionOptions {
  noDebug?: boolean;
  parentSession?: IDebugSession;
  lifecycleManagedByParent?: boolean;
  repl?: IDebugSessionReplMode;
  compact?: boolean;
}

export const IDebugSession = Symbol('DebugSession');

export const IDebugSessionManager = Symbol('DebugSessionManager');
export interface IDebugSessionManager {
  fireWillStartDebugSession(): Promise<void>;
  resolveConfiguration(options: Readonly<DebugSessionOptions>): Promise<IDebugSessionDTO | undefined>;
  resolveDebugConfiguration(
    configuration: DebugConfiguration,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration | undefined | null>;
  fireWillResolveDebugConfiguration(debugType: string): Promise<void>;
  report(name: string, msg: string | undefined, extra?: any): void;
  reportTime(name: string, defaults?: any): (msg: string | undefined, extra?: any) => number;
  reportAction(sessionId: string, threadId: number | string | undefined, action: string): void;
  getExtra(sessionId: string | undefined, threadId: number | string | undefined): DebugThreadExtra | undefined;
  setExtra(sessionId: string, threadId: string, extra?: DebugThreadExtra);

  [key: string]: any;
}

export interface IDebugSession extends IDisposable {
  state: DebugState;
  parentSession: IDebugSession | undefined;
  id: string;
  hasSeparateRepl: () => boolean;
  getDebugProtocolBreakpoint(breakpointId: string): DebugProtocol.Breakpoint | undefined;
  compact: boolean;
  on: <K extends keyof DebugEventTypes>(kind: K, listener: (e: DebugEventTypes[K]) => any) => IDisposable;
  sendRequest<K extends keyof DebugRequestTypes>(
    command: K,
    args: DebugRequestTypes[K][0],
    token?: CancellationToken | undefined,
  ): Promise<DebugRequestTypes[K][1]>;
  restart(): Promise<boolean>;
  disconnect(restart?: boolean | undefined): Promise<void>;
  terminate(restart?: boolean | undefined): Promise<void>;
}

/**
 * 埋点专用的额外数据
 */
export interface DebugBaseExtra {
  /**
   * adapterID 区分语言
   */
  adapterID: string;

  /**
   * request 区分 attach 或 launch
   */
  request: 'attach' | 'launch';

  /**
   * 跟 sessionId 一一对应，先于 sessionId 生成，可以跟踪初始化时的事件
   */
  traceId: string;

  /**
   * 是否为远程调试
   * 0: 非远程
   * 1: 远程
   */
  remote: 0 | 1;
}
export interface DebugSessionExtra extends DebugBaseExtra {
  threads: Map<string, DebugThreadExtra>;
}

export interface DebugThreadExtra extends DebugBaseExtra {
  threadId?: string;

  /**
   * 当前的用户操作
   */
  action?: string;

  /**
   * 文件所在的路径和行号
   */
  filePath?: string;
  fileLineNumber?: number;
}

let DEBUG_SESSION_SEQUENCE_ID = 1;

export function getSequenceId() {
  // 获取递增的请求 ID
  return DEBUG_SESSION_SEQUENCE_ID++;
}

export interface DebugExitEvent {
  code?: number;
  reason?: string | Error;
}
export interface DebugRequestTypes {
  attach: [DebugProtocol.AttachRequestArguments, DebugProtocol.AttachResponse];
  breakpointLocations: [DebugProtocol.BreakpointLocationsArguments, DebugProtocol.BreakpointLocationsResponse];
  completions: [DebugProtocol.CompletionsArguments, DebugProtocol.CompletionsResponse];
  configurationDone: [DebugProtocol.ConfigurationDoneArguments, DebugProtocol.ConfigurationDoneResponse];
  continue: [DebugProtocol.ContinueArguments, DebugProtocol.ContinueResponse];
  disconnect: [DebugProtocol.DisconnectArguments, DebugProtocol.DisconnectResponse];
  evaluate: [DebugProtocol.EvaluateArguments, DebugProtocol.EvaluateResponse];
  exceptionInfo: [DebugProtocol.ExceptionInfoArguments, DebugProtocol.ExceptionInfoResponse];
  goto: [DebugProtocol.GotoArguments, DebugProtocol.GotoResponse];
  gotoTargets: [DebugProtocol.GotoTargetsArguments, DebugProtocol.GotoTargetsResponse];
  initialize: [DebugProtocol.InitializeRequestArguments, DebugProtocol.InitializeResponse];
  launch: [DebugProtocol.LaunchRequestArguments, DebugProtocol.LaunchResponse];
  loadedSources: [DebugProtocol.LoadedSourcesArguments, DebugProtocol.LoadedSourcesResponse];
  modules: [DebugProtocol.ModulesArguments, DebugProtocol.ModulesResponse];
  next: [DebugProtocol.NextArguments, DebugProtocol.NextResponse];
  pause: [DebugProtocol.PauseArguments, DebugProtocol.PauseResponse];
  restart: [DebugProtocol.RestartArguments, DebugProtocol.RestartResponse];
  restartFrame: [DebugProtocol.RestartFrameArguments, DebugProtocol.RestartFrameResponse];
  reverseContinue: [DebugProtocol.ReverseContinueArguments, DebugProtocol.ReverseContinueResponse];
  scopes: [DebugProtocol.ScopesArguments, DebugProtocol.ScopesResponse];
  setBreakpoints: [DebugProtocol.SetBreakpointsArguments, DebugProtocol.SetBreakpointsResponse];
  setExceptionBreakpoints: [
    DebugProtocol.SetExceptionBreakpointsArguments,
    DebugProtocol.SetExceptionBreakpointsResponse,
  ];
  setExpression: [DebugProtocol.SetExpressionArguments, DebugProtocol.SetExpressionResponse];
  setFunctionBreakpoints: [DebugProtocol.SetFunctionBreakpointsArguments, DebugProtocol.SetFunctionBreakpointsResponse];
  setVariable: [DebugProtocol.SetVariableArguments, DebugProtocol.SetVariableResponse];
  source: [DebugProtocol.SourceArguments, DebugProtocol.SourceResponse];
  stackTrace: [DebugProtocol.StackTraceArguments, DebugProtocol.StackTraceResponse];
  stepBack: [DebugProtocol.StepBackArguments, DebugProtocol.StepBackResponse];
  stepIn: [DebugProtocol.StepInArguments, DebugProtocol.StepInResponse];
  stepInTargets: [DebugProtocol.StepInTargetsArguments, DebugProtocol.StepInTargetsResponse];
  stepOut: [DebugProtocol.StepOutArguments, DebugProtocol.StepOutResponse];
  terminate: [DebugProtocol.TerminateArguments, DebugProtocol.TerminateResponse];
  terminateThreads: [DebugProtocol.TerminateThreadsArguments, DebugProtocol.TerminateThreadsResponse];
  threads: [DebugProtocol.ThreadsArguments | null, DebugProtocol.ThreadsResponse];
  variables: [DebugProtocol.VariablesArguments, DebugProtocol.VariablesResponse];
  cancel: [DebugProtocol.CancelArguments, DebugProtocol.CancelResponse];
}

export interface DebugEventTypes {
  breakpoint: DebugProtocol.BreakpointEvent;
  capabilities: DebugProtocol.CapabilitiesEvent;
  continued: DebugProtocol.ContinuedEvent;
  exited: DebugExitEvent;
  initialized: DebugProtocol.InitializedEvent;
  loadedSource: DebugProtocol.LoadedSourceEvent;
  module: DebugProtocol.ModuleEvent;
  output: DebugProtocol.OutputEvent;
  process: DebugProtocol.ProcessEvent;
  stopped: DebugProtocol.StoppedEvent;
  terminated: DebugProtocol.TerminatedEvent;
  thread: DebugProtocol.ThreadEvent;
  progressStart: DebugProtocol.ProgressStartEvent;
  progressUpdate: DebugProtocol.ProgressUpdateEvent;
  progressEnd: DebugProtocol.ProgressEndEvent;
  invalidated: DebugProtocol.InvalidatedEvent;
}
