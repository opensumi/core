import { Event, Disposable, Deferred, IDisposable } from '@opensumi/ide-core-common';
import { ITerminalLaunchError, ITerminalProcessExtHostProxy, IStartExtensionTerminalRequest } from './extension';
import { IWidgetGroup, IWidget } from './resize';
import { ITerminalClient, ITerminalExitEvent, ITerminalExternalLinkProvider } from './client';
import { TerminalOptions, ITerminalInfo } from './pty';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import type { ILinkHoverTargetOptions } from '../browser/links/link-manager';

export interface ITerminalExternalClient {
  readonly id: string;
  readonly processId: Promise<number | undefined>;
  readonly name: string;
  show(preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

export interface IBoundSize {
  width: number;
  height: number;
}

export const ITerminalController = Symbol('ITerminalController');
export interface ITerminalController extends Disposable {
  ready: Deferred<void>;
  focused: boolean;
  clients: Map<string, ITerminalClient>;
  activeClient?: ITerminalClient;
  themeBackground: string;
  contextKeyService?: IContextKeyService;
  initContextKey(dom: HTMLDivElement): void;
  firstInitialize(): void;
  recovery(history: ITerminalBrowserHistory): Promise<void>;
  reconnect(): Promise<void>;
  focus(): void;
  blur(): void;
  findClientFromWidgetId(widgetId: string): ITerminalClient | undefined;
  createClientWithWidget(options: TerminalOptions): ITerminalClient;
  clearCurrentGroup(): void;
  clearAllGroups(): void;
  showTerminalPanel(): void;
  hideTerminalPanel(): void;
  toJSON(): ITerminalBrowserHistory;

  onDidOpenTerminal: Event<ITerminalInfo>;
  onDidCloseTerminal: Event<ITerminalExitEvent>;
  onDidChangeActiveTerminal: Event<string>;

  requestStartExtensionTerminal(
    proxy: ITerminalProcessExtHostProxy,
    cols: number,
    rows: number,
  ): Promise<ITerminalLaunchError | undefined>;
  readonly onInstanceRequestStartExtensionTerminal: Event<IStartExtensionTerminalRequest>;

  registerLinkProvider(provider: ITerminalExternalLinkProvider): IDisposable;
}

export const ITerminalSearchService = Symbol('ITerminalSearchService');
export interface ITerminalSearchService {
  show: boolean;
  input: string;
  open(): void;
  clear(): void;
  close(): void;
  search(): void;
  onOpen: Event<void>;
}

export const ITerminalGroupViewService = Symbol('ITerminalGroupViewService');
export interface ITerminalGroupViewService {
  currentGroupIndex: number;
  currentGroupId: string;
  currentWidgetId: string;
  currentGroup: IWidgetGroup;
  currentWidget: IWidget;
  groups: IWidgetGroup[];

  createGroup(): number;
  getGroup(index: number): IWidgetGroup;
  selectGroup(index: number): void;
  removeGroup(index: number): void;

  createWidget(group: IWidgetGroup, id?: string, reuse?: boolean, isSimpleWidget?: boolean): IWidget;
  getWidget(id: string): IWidget;
  selectWidget(widgetId: string): void;
  removeWidget(id: string): void;

  onWidgetCreated: Event<IWidget>;
  onWidgetSelected: Event<IWidget>;
  onWidgetDisposed: Event<IWidget>;
  onWidgetEmpty: Event<void>;

  empty(): boolean;
  clear(): void;
}

export interface ITerminalBrowserHistory {
  current: string | undefined;
  groups: (string[] | { clientId: string }[])[];
}

export const ITerminalHoverManagerService = Symbol('ITerminalHoverManagerService');
export interface ITerminalHoverManagerService extends IDisposable {
  showHover(targetOptions: ILinkHoverTargetOptions, text: string, linkHandler: (url: string) => void): IDisposable;
}
