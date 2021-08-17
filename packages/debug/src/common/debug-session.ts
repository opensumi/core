import { DebugProtocol } from '@ali/vscode-debugprotocol';
import { IDisposable } from '@ali/ide-core-browser';
import { DebugSessionOptions, InternalDebugSessionOptions } from './debug-session-options';
import { DebugConfiguration } from './debug-configuration';
import { DebugEventTypes } from '../browser';

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
  repl?: IDebugSessionReplMode;
  compact?: boolean;
}

export const IDebugSession = Symbol('DebugSession');

export const IDebugSessionManager = Symbol('DebugSessionManager');
export interface IDebugSessionManager {
  fireWillStartDebugSession(): Promise<void>;
  resolveConfiguration(options: Readonly<DebugSessionOptions>): Promise<InternalDebugSessionOptions>;
  resolveDebugConfiguration(configuration: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration>;
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
  return DEBUG_SESSION_SEQUENCE_ID ++;
}
