import { DebugConfiguration } from './debug-configuration';
import { IDebugSessionOptions } from './debug-session';

export interface DebugSessionOptions extends IDebugSessionOptions {
  configuration: DebugConfiguration;
  workspaceFolderUri?: string;
  index: number;
}

export interface IDebugSessionDTO extends DebugSessionOptions {
  id: number;
  parent?: string;
}

export namespace IDebugSessionDTO {
  export function is(options: DebugSessionOptions): options is IDebugSessionDTO {
      return ('id' in options);
  }
}
