import { DebugState, IDebugSessionManager } from './debug-session';

export const IDebugProgress = Symbol('DebugProgress');

export interface IDebugProgress {
  run: (sm: IDebugSessionManager) => void;
  onDebugServiceStateChange: (state: DebugState) => void;
}
