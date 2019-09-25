import { DebugSessionOptions, InternalDebugSessionOptions } from './debug-session-options';
import { DebugConfiguration } from './debug-configuration';

export const IDebugSession = Symbol('DebugSession');

export const IDebugSessionManager = Symbol('DebugSessionManager');
export interface IDebugSessionManager {
  fireWillStartDebugSession(): Promise<void>;
  resolveConfiguration(options: Readonly<DebugSessionOptions>): Promise<InternalDebugSessionOptions>;
  resolveDebugConfiguration(configuration: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration>;
  fireWillResolveDebugConfiguration(debugType: string): Promise<void> ;

  [key: string]: any;
}
