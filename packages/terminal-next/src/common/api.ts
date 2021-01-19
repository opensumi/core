import { Event } from '@ali/ide-core-common';
import { TerminalOptions, ITerminalInfo } from './pty';
import { ITerminalExternalClient } from './controller';

export const ITerminalApiService = Symbol('ITerminalApiService');
export interface ITerminalApiService {
  createTerminal(options: TerminalOptions): Promise<ITerminalExternalClient>;
  sendText(id: string, text: string, addNewLine?: boolean): void;
  getProcessId(sessionId: string): Promise<number | undefined>;

  onDidOpenTerminal: Event<ITerminalInfo>;
  onDidCloseTerminal: Event<string>;
  onDidChangeActiveTerminal: Event<string>;

  terminals: ITerminalInfo[];

  showTerm(id: string, preserveFocus?: boolean): void;
  hideTerm(id: string): void;
  removeTerm(id: string): void;

  createWidget(uniqName: string, widgetRenderFunc: (element: HTMLDivElement) => void): void;

  scheduleReconnection(): void;
}
