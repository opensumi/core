import { Injectable } from '@ali/common-di';

export const IDebugConsoleSessionManager = Symbol('IDebugConsoleSessionManager');

export interface IDebugConsoleSessionManager {
  activeConsoleSession: any;
  currentConsoleSession: any;
}

// TODO
@Injectable()
export class DebugConsoleSessionManager implements IDebugConsoleSessionManager {

  get activeConsoleSession() {
    return null;
  }

  get currentConsoleSession() {
    return null;
  }
}
