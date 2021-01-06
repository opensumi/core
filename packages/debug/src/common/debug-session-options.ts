import { DebugConfiguration } from './debug-configuration';
import { IDebugSessionOptions } from './debug-session';

export interface DebugSessionOptions extends IDebugSessionOptions {
  configuration: DebugConfiguration;
  workspaceFolderUri?: string;
  index: number;
}

export interface InternalDebugSessionOptions extends DebugSessionOptions {
  id: number;
}

export namespace InternalDebugSessionOptions {
  export function is(options: DebugSessionOptions): options is InternalDebugSessionOptions {
      return ('id' in options);
  }
}
