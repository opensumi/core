import { Terminal } from 'xterm';
import { Disposable, Event, Deferred } from '@ali/ide-core-common';
import { Event as CoreEvent } from '@ali/ide-core-browser';
import { TerminalOptions } from './pty';
import { IWidget } from './resize';

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
   * 自动聚焦
   */
  autofocus: boolean;

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
   * Xterm 实例
   */
  term: Terminal;

  /**
   * 渲染窗口
   */
  widget: IWidget;
  /**
   * 接收到 pty 消息事件
   */
  onReceivePtyMessage: CoreEvent<{ id: string, message: string }>;

  /**
   * 预先连接后端
   */
  attach(): Promise<void>;

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
   * 重新计算宽高
   */
  layout(): void;

  /**
   * 全选内容
   */
  selectAll(): void;

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
   * clear 参数用于判断是否需要清理 meta 信息，
   * 不需要 clear 参数的时候基本为正常推出，
   * 异常的时候需要将 clear 设为 false，保留现场
   *
   * @param clear
   */
  dispose(clear?: boolean): void;
}

export const ITerminalClientFactory = Symbol('ITerminalClientFactory');
export type ITerminalClientFactory = (widget: IWidget, options?: TerminalOptions, autofocus?: boolean) => ITerminalClient;

export interface ITerminalConnection {
  name: string;
  readonly: boolean;
  sendData(data: string | ArrayBuffer): void;
  onData: Event<string | ArrayBuffer>;
}
