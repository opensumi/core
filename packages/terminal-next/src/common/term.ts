import { Terminal, ITerminalOptions } from 'xterm';

export const ITerminalExternalService = Symbol('ITerminalExternalService');
export interface ITerminalExternalService {
  makeId(): string;
  getOptions(): ITerminalOptions;
  sendText(id: string, message: string): Promise<void>;
  attach(term: Terminal, attachMethod: (s: WebSocket) => void): Promise<void>;
  resize(cols: number, rows: number): Promise<void>;
}
