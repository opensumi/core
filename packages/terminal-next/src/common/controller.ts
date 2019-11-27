import { Event } from '@ali/ide-core-common';
import { IWidgetGroup } from './resize';
import { ITerminalError } from './error';
import { TerminalOptions, TerminalInfo } from './pty';

export interface ITerminalClient {
  readonly id: string;
  readonly pid: number;
  readonly name: string;
  readonly isActive: boolean;
  show(): void;
  attach(): Promise<void>;
  dispose(): void;
}

export const ITerminalController = Symbol('ITerminalController');
export interface ITerminalController {
  currentGroup: IWidgetGroup | undefined;
  groups: IWidgetGroup[];
  state: { index: number };
  errors: Map<string, ITerminalError>;
  recovery(history: any): Promise<void>;
  firstInitialize(): void;
  removeFocused(): void;
  snapshot(index: number): string;

  addWidget(client?: any): void;
  focusWidget(widgetId: string): void;
  removeWidget(widgetId: string): void;

  createGroup(selected?: boolean): number;
  selectGroup(index: number): void;

  drawTerminalClient(dom: HTMLDivElement, termId: string, restore?: boolean): Promise<void>;
  showTerminalClient(widgetId: string): Promise<void>;
  retryTerminalClient(widgetId: string): Promise<void>;
  layoutTerminalClient(widgetId: string): void;
  eraseTerminalClient(termId: string): void;
  toJSON(): { groups: any[] };

  createTerminal(options: TerminalOptions): ITerminalClient;
  getProcessId(sessionId: string): Promise<number>;

  terminals: ITerminalClient[];
  isTermActive(clientId: string): boolean;
  showTerm(id: string, preserveFocus?: boolean): void;
  hideTerm(id: string): void;
  removeTerm(id?: string): void;
  sendText(id: string, text: string, addNewLine?: boolean): void;

  onDidChangeActiveTerminal: Event<string>;
  onDidCloseTerminal: Event<string>;
  onDidOpenTerminal: Event<TerminalInfo>;
}
