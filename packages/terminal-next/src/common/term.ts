import { Terminal, ITerminalOptions } from 'xterm';
import { ITerminalError } from './error';

export const ITerminalExternalService = Symbol('ITerminalExternalService');
export interface ITerminalExternalService {
  makeId(): string;
  restore(): string;
  meta(sessionId: string): string;
  getOptions(): ITerminalOptions;
  sendText(id: string, message: string): Promise<void>;
  attach(sessionId: string, term: Terminal, restore: boolean, meta: string, attachMethod: (s: WebSocket) => void): Promise<void>;
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
  disposeById(sessionId: string): void;

  onError(handler: (error: ITerminalError) => void): void;
}
