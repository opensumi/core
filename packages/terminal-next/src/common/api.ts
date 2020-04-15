import { Event } from '@ali/ide-core-common';
import { TerminalOptions, ITerminalInfo } from './pty';
import { ITerminalExternalClient } from './controller';

export const ITerminalApiService = Symbol('ITerminalApiService');
export interface ITerminalApiService {
  createTerminal(options: TerminalOptions): ITerminalExternalClient;
  sendText(id: string, text: string, addNewLine?: boolean): void;
  getProcessId(sessionId: string): Promise<number>;

  onDidOpenTerminal: Event<ITerminalInfo>;
  onDidCloseTerminal: Event<string>;
  onDidChangeActiveTerminal: Event<string>;

  terminals: ITerminalInfo[];

  showTerm(id: string, preserveFocus?: boolean): void;
  hideTerm(id: string): void;
  removeTerm(id: string): void;
}
