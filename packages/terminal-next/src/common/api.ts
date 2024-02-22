import { Event } from '@opensumi/ide-core-common';

import { ITerminalExitEvent, ITerminalTitleChangeEvent } from './client';
import { ITerminalExternalClient } from './controller';
import { ITerminalInfo, TerminalOptions } from './pty';

export const ITerminalApiService = Symbol('ITerminalApiService');
export interface ITerminalApiService {
  createTerminal(options: TerminalOptions, id?: string): Promise<ITerminalExternalClient>;
  sendText(id: string, text: string, addNewLine?: boolean): void;
  getProcessId(sessionId: string): Promise<number | undefined>;
  getDefaultShellPath(): Promise<string>;

  onDidOpenTerminal: Event<ITerminalInfo>;
  onDidCloseTerminal: Event<ITerminalExitEvent>;
  onDidTerminalTitleChange: Event<ITerminalTitleChangeEvent>;
  onDidChangeActiveTerminal: Event<string>;

  terminals: ITerminalInfo[];

  showTerm(id: string, preserveFocus?: boolean): void;
  hideTerm(id: string): void;
  removeTerm(id: string): void;

  createWidget(uniqName: string, widgetRenderFunc: (element: HTMLDivElement) => void): void;

  scheduleReconnection(): void;
}
