import { CancellationToken, Event, IDisposable } from '@opensumi/ide-core-common';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { DebugConfiguration } from './debug-configuration';
import { DebugSessionOptions, IDebugSessionDTO } from './debug-session-options';

export interface IDebugExceptionInfo {
  readonly id?: string;
  readonly description?: string;
  readonly breakMode: string | null;
  readonly details?: DebugProtocol.ExceptionDetails;
}

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
  currentSession: IDebugSession | undefined;
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
  // 状态管理
  /** 当前调试会话的状态 */
  state: DebugState;

  /** 父调试会话（如果有） */
  parentSession: IDebugSession | undefined;

  /** 唯一标识符 */
  id: string;

  /** 调试适配器的能力 */
  capabilities: DebugProtocol.Capabilities;

  /** 是否压缩输出 */
  compact: boolean;

  // 事件处理
  /** 内存无效化事件 */
  onDidInvalidateMemory: Event<DebugProtocol.MemoryEvent>;

  /** 状态变化事件 */
  onDidChangeState: Event<DebugState>;

  /** 进度开始事件 */
  onDidProgressStart: Event<DebugProtocol.ProgressStartEvent>;

  /** 进度更新事件 */
  onDidProgressUpdate: Event<DebugProtocol.ProgressUpdateEvent>;

  /** 进度结束事件 */
  onDidProgressEnd: Event<DebugProtocol.ProgressEndEvent>;

  /** 调试适配器退出事件 */
  onDidExitAdapter: Event<void>;

  // 操作方法
  /** 取消当前操作 */
  cancel(reason?: string): Promise<DebugProtocol.CancelResponse | undefined>;

  /** 发送请求到调试适配器 */
  sendRequest<K extends keyof DebugRequestTypes>(
    command: K,
    args: DebugRequestTypes[K][0],
    token?: CancellationToken | undefined,
  ): Promise<DebugRequestTypes[K][1]>;

  /** 获取调试协议中的断点 */
  getDebugProtocolBreakpoint(breakpointId: string): DebugProtocol.Breakpoint | undefined;

  /** 判断是否具有独立的 REPL */
  hasSeparateRepl(): boolean;

  /** 监听特定类型的事件 */
  on<K extends keyof DebugEventTypes>(kind: K, listener: (e: DebugEventTypes[K]) => any): IDisposable;

  /** 断开连接 */
  disconnect(restart?: boolean | undefined): Promise<void>;

  /** 终止调试会话 */
  terminate(restart?: boolean | undefined): Promise<void>;

  /** 重启调试会话 */
  restart(args: DebugProtocol.RestartArguments): Promise<boolean>;

  // 内存操作
  /** 读取内存 */
  readMemory(
    memoryReference: string,
    offset: number,
    count: number,
  ): Promise<DebugProtocol.ReadMemoryResponse | undefined>;

  /** 写入内存 */
  writeMemory(
    memoryReference: string,
    offset: number,
    data: string,
    allowPartial?: boolean | undefined,
  ): Promise<DebugProtocol.WriteMemoryResponse | undefined>;
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
  readMemory: [DebugProtocol.ReadMemoryArguments, DebugProtocol.ReadMemoryResponse];
  writeMemory: [DebugProtocol.WriteMemoryArguments, DebugProtocol.WriteMemoryResponse];
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
  memory: DebugProtocol.MemoryEvent;
  invalidated: DebugProtocol.InvalidatedEvent;
}
