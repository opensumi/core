import { IEvent } from '@xterm/xterm';

import { IContextKeyService } from '@opensumi/ide-core-browser';
import { Deferred, Disposable, Event, IDisposable, Uri } from '@opensumi/ide-core-common';
import { IObservable } from '@opensumi/ide-monaco/lib/common/observable';

import {
  ITerminalClient,
  ITerminalExitEvent,
  ITerminalExternalLinkProvider,
  ITerminalTitleChangeEvent,
} from './client';
import { IStartExtensionTerminalRequest, ITerminalLaunchError, ITerminalProcessExtHostProxy } from './extension';
import { ITerminalProfile } from './profile';
import { ICreateTerminalOptions, IShellLaunchConfig, ITerminalInfo, TerminalOptions } from './pty';
import { IWidget, IWidgetGroup } from './resize';

// eslint-disable-next-line import/no-restricted-paths
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

export interface ICreateClientWithWidgetOptions {
  terminalOptions: TerminalOptions;
  /**
   * 插件进程传递的唯一 ID
   */
  id?: string;
  /**
   * pty 进程退出后是否自动关闭 terminal 控件
   */
  closeWhenExited?: boolean;

  /**
   * 是否为 TaskExecutor
   */
  isTaskExecutor?: boolean;

  /**
   * 作为 TaskExecutor 时对应的 taskId
   */
  taskId?: string;

  /**
   * 自定义的参数，由上层集成方自行控制
   */
  args?: any;

  beforeCreate?: (terminalId: string) => void;
}

export interface TerminalCliterFilter {
  id?: string;
  name?: string;
  isTaskExecutor?: boolean;
}

export const ITerminalController = Symbol('ITerminalController');
export interface ITerminalController extends Disposable {
  ready: Deferred<void>;
  focused: boolean;
  clients: Map<string, ITerminalClient>;
  activeClient?: ITerminalClient;
  themeBackground: string;
  contextKeyService?: IContextKeyService;
  viewReady: Deferred<void>;
  disposeTerminalClients(filter?: TerminalCliterFilter): void;
  initContextKey(dom: HTMLDivElement): void;
  firstInitialize(): void;
  recovery(history: ITerminalBrowserHistory): Promise<void>;
  reconnect(): Promise<void>;
  focus(): void;
  blur(): void;
  onContextMenu(e: React.MouseEvent<HTMLElement>): void;
  findClientFromWidgetId(widgetId: string): ITerminalClient | undefined;
  createTerminalWithWidgetByTerminalOptions(options: ICreateClientWithWidgetOptions): Promise<ITerminalClient>;
  createTerminal(options: ICreateTerminalOptions): Promise<ITerminalClient>;
  createTerminalWithWidget(options: ICreateTerminalOptions): Promise<ITerminalClient>;
  clearCurrentGroup(): void;
  clearAllGroups(): void;
  showTerminalPanel(): void;
  hideTerminalPanel(): void;
  toggleTerminalPanel(): void;
  toJSON(): ITerminalBrowserHistory;
  convertTerminalOptionsToLaunchConfig(options: TerminalOptions): IShellLaunchConfig;
  convertProfileToLaunchConfig(
    shellLaunchConfigOrProfile: IShellLaunchConfig | ITerminalProfile | undefined,
    cwd?: Uri | string,
  ): IShellLaunchConfig;
  onDidOpenTerminal: Event<ITerminalInfo>;
  onDidCloseTerminal: Event<ITerminalExitEvent>;
  onDidTerminalTitleChange: Event<ITerminalTitleChangeEvent>;
  onDidChangeActiveTerminal: Event<string>;
  onThemeBackgroundChange: Event<string>;

  requestStartExtensionTerminal(
    proxy: ITerminalProcessExtHostProxy,
    cols: number,
    rows: number,
  ): Promise<ITerminalLaunchError | undefined>;
  readonly onInstanceRequestStartExtensionTerminal: Event<IStartExtensionTerminalRequest>;

  registerLinkProvider(provider: ITerminalExternalLinkProvider): IDisposable;
}

export interface IUIState {
  isMatchCase: boolean;
  isWholeWord: boolean;
  isUseRegexp: boolean;
}

export interface ISearchResult {
  resultCount: number;
  resultIndex: number;
}

export const ITerminalSearchService = Symbol('ITerminalSearchService');
export interface ITerminalSearchService {
  isVisible: boolean;
  onVisibleChange: Event<boolean>;
  UIState: IUIState;
  onResultChange: IEvent<ISearchResult> | undefined;

  text: string;

  open(): void;
  clear(): void;
  close(): void;
  search(): void;
  searchNext(): void;
  searchPrevious(): void;
  updateUIState(state: Partial<IUIState>): void;
}

export const ITerminalGroupViewService = Symbol('ITerminalGroupViewService');
export interface ITerminalGroupViewService {
  readonly groups: IObservable<IWidgetGroup[]>;
  readonly currentGroupIndex: IObservable<number>;
  readonly currentGroup: IObservable<IWidgetGroup>;
  readonly currentGroupId: IObservable<string>;
  readonly currentWidgetId: IObservable<string>;
  readonly currentWidget: IObservable<IWidget>;

  createGroup(): number;
  getGroup(index: number): IWidgetGroup;
  selectGroup(index: number): void;
  removeGroup(index: number): void;

  swapGroup(i: number, j: number): void;

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
  groups: { client: string; task?: string }[][];
}

export const ITerminalHoverManagerService = Symbol('ITerminalHoverManagerService');
export interface ITerminalHoverManagerService extends IDisposable {
  showHover(targetOptions: ILinkHoverTargetOptions, text: string, linkHandler: (url: string) => void): IDisposable;
}
