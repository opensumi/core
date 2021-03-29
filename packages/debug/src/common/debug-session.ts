import { IDisposable } from '@ali/ide-core-browser';
import { DebugSessionOptions, InternalDebugSessionOptions } from './debug-session-options';
import { DebugConfiguration } from './debug-configuration';
import { DebugState, DebugEventTypes } from '../browser';

export type IDebugSessionReplMode = 'separate' | 'mergeWithParent';

export interface IDebugSessionOptions {
  noDebug?: boolean;
  parentSession?: IDebugSession;
  repl?: IDebugSessionReplMode;
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

  [key: string]: any;
}

export interface IDebugSession extends IDisposable {
  state: DebugState;
  parentSession: IDebugSession | undefined;
  id: string;
  hasSeparateRepl: () => boolean;
  on: <K extends keyof DebugEventTypes>(kind: K, listener: (e: DebugEventTypes[K]) => any) => IDisposable;
}
