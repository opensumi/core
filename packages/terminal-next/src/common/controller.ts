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
  searchState: { input: string, show: boolean };
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
  clearCurrentWidget(): void;

  createGroup(selected?: boolean): number;
  selectGroup(index: number): void;
  removeAllGroups(): void;
  clearAllGroups(): void;

  drawTerminalClient(dom: HTMLDivElement, termId: string, restore?: boolean, meta?: string): Promise<void>;
  retryTerminalClient(widgetId: string): Promise<void>;
  layoutTerminalClient(widgetId: string): void;
  toJSON(): { groups: any[] };

  terminals: TerminalInfo[];

  createTerminal(options: TerminalOptions): ITerminalClient;
  getProcessId(sessionId: string): Promise<number>;

  isTermActive(clientId: string): boolean;
  showTerm(id: string, preserveFocus?: boolean): void;
  hideTerm(id: string): void;
  removeTerm(id?: string): void;
  sendText(id: string, text: string, addNewLine?: boolean): void;

  openSearchInput(): void;
  closeSearchInput(): void;
  clearSearchInput(): void;
  search(): void;

  onDidChangeActiveTerminal: Event<string>;
  onDidCloseTerminal: Event<string>;
  onDidOpenTerminal: Event<TerminalInfo>;

  getCurrentClient<T>(): T | undefined;

  isFocus: boolean;
  focus(): void;
  blur(): void;
}
