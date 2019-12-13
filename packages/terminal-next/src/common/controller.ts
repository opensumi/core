import { Event } from '@ali/ide-core-common';
import { IWidgetGroup } from './resize';
import { ITerminalError } from './error';
import { TerminalOptions, TerminalInfo } from './pty';

export interface ITerminalClient {
  readonly id: string;
  readonly processId: number | undefined;
  readonly name: string;
  show(): void;
  hide(): void;
  dispose(): void;
}

export const ITerminalController = Symbol('ITerminalController');
export interface ITerminalController {
  currentGroup: IWidgetGroup | undefined;
  groups: IWidgetGroup[];
  state: { index: number };
  errors: Map<string, ITerminalError>;
  reconnect(): Promise<void>;
  recovery(history: any): Promise<void>;
  firstInitialize(): void;
  removeFocused(): void;
  snapshot(index: number): string;
  themeBackground: string;

  addWidget(client?: any): void;
  focusWidget(widgetId: string): void;
  removeWidget(widgetId: string): void;

  createGroup(selected?: boolean): number;
  selectGroup(index: number): void;
  clearGroup(index: number): void;

  drawTerminalClient(dom: HTMLDivElement, termId: string, restore?: boolean, meta?: string): Promise<void>;
  showTerminalClient(widgetId: string): Promise<void>;
  retryTerminalClient(widgetId: string): Promise<void>;
  layoutTerminalClient(widgetId: string): void;
  eraseTerminalClient(termId: string): void;
  toJSON(): { groups: any[] };

  terminals: TerminalInfo[];

  createTerminal(options: TerminalOptions): ITerminalClient;
  getProcessId(sessionId: string): Promise<number>;

  isTermActive(clientId: string): boolean;
  showTerm(id: string, preserveFocus?: boolean): void;
  hideTerm(id: string): void;
  removeTerm(id?: string): void;
  sendText(id: string, text: string, addNewLine?: boolean): void;

  onDidChangeActiveTerminal: Event<string>;
  onDidCloseTerminal: Event<string>;
  onDidOpenTerminal: Event<TerminalInfo>;
}
