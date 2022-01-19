import { Terminal } from 'xterm';
import { IDisposable, Disposable, Event, Deferred } from '@opensumi/ide-core-common';
import { INodePtyInstance, TerminalOptions, ICreateTerminalOptions } from './pty';
import { IWidget } from './resize';

export interface ITerminalDataEvent {
  id: string;
  data: string | ArrayBuffer;
}

export interface ITerminalExitEvent {
  id: string;
  code?: number;
}

export interface ITerminalClient extends Disposable {
  /**
   * 标识终端客户端的唯一 id
   */
  id: string;

  /**
   * 终端客户端对应的后端进程 id
   */
  pid: Promise<number | undefined>;

  /**
   * 终端客户端对应的名称，可能是用户自定义，也可能来自后端
   */
  name: string;

  /**
   * 终端客户端创建所使用的后端选项
   */
  options: TerminalOptions;

  /**
   * 终端客户端渲染所使用的上层 dom 节点
   */
  container: HTMLDivElement;

  /**
   * 终端已就绪
   */
  ready: boolean;

  /**
   * 终端客户端是否和后端相连接
   */
  attached: Deferred<void>;

  /**
   * 首次消息输出
   */
  firstOutput: Deferred<void>;

  /**
   *
   */
  show: Deferred<void> | null;

  /**
   * Xterm 实例
   */
  term: Terminal;

  /**
   * 渲染窗口
   */
  widget: IWidget;

  /**
   * 终端客户端获取输入焦点
   */
  focus(): void;

  /**
   * 清除内容
   */
  clear(): void;

  /**
   * 重置
   */
  reset(): void;

  /**
   * 全选内容
   */
  selectAll(): void;
  /**
   * 获取选择的内容
   */
  getSelection(): string;
  /**
   * 粘贴文本
   * @param text
   */
  paste(text: string): void;
  /**
   * 向下查找字符串
   *
   * @param text 用户输入的字符串
   */
  findNext(text: string): void;

  /**
   * 向后端发送一段字符串
   *
   * @param message 发送的字符串消息
   */
  sendText(message: string): Promise<void>;

  /**
   * 更新终端客户端渲染主题
   */
  updateTheme(): void;

  /**
   * 更新终端客户端配置
   */
  updateOptions(options: TerminalOptions): void;

  /**
   * clear 参数用于判断是否需要清理 meta 信息，
   * 不需要 clear 参数的时候基本为正常推出，
   * 异常的时候需要将 clear 设为 false，保留现场
   *
   * @param clear
   */
  dispose(clear?: boolean): void;

  /**
   * stdout 输出事件
   */
  onOutput: Event<ITerminalDataEvent>;

  /**
   * stdin 输入事件
   */
  onInput: Event<ITerminalDataEvent>;

  /**
   * 退出事件
   */
  onExit: Event<ITerminalExitEvent>;

  /**
   * linkManager 初始化成功事件
   */
  onLinksReady: Event<ITerminalClient>;

  areLinksReady: boolean;

  /**
   * 注册 LinkProvider
   */
  registerLinkProvider(provider: ITerminalExternalLinkProvider): IDisposable;
}

export const ITerminalClientFactory = Symbol('ITerminalClientFactory');
export type ITerminalClientFactory = (
  widget: IWidget,
  options?: TerminalOptions,
  disposable?: IDisposable,
) => Promise<ITerminalClient>;

export const ITerminalClientFactory2 = Symbol('ITerminalClientFactory2');
export type ITerminalClientFactory2 = (
  widget: IWidget,
  options?: ICreateTerminalOptions,
  disposable?: IDisposable,
) => Promise<ITerminalClient>;

export interface ITerminalConnection {
  name: string;
  readonly: boolean;
  sendData(data: string | ArrayBuffer): void;
  onData: Event<string | ArrayBuffer>;
  onExit?: Event<number | undefined>;
  ptyInstance?: INodePtyInstance;
}

/**
 * Similar to xterm.js' ILinkProvider but using promises and hides xterm.js internals (like buffer
 * positions, decorations, etc.) from the rest of vscode. This is the interface to use for
 * workbench integrations.
 */
export interface ITerminalExternalLinkProvider {
  provideLinks(instance: ITerminalClient, line: string): Promise<ITerminalLink[] | undefined>;
}

export interface ITerminalLink {
  /** The startIndex of the link in the line. */
  startIndex: number;
  /** The length of the link in the line. */
  length: number;
  /** The descriptive label for what the link does when activated. */
  label?: string;
  /**
   * Activates the link.
   * @param text The text of the link.
   */
  activate(text: string): void;
}
