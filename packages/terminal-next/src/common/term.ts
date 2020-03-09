import { IDisposable } from '@ali/ide-core-common';
import { Terminal, ITerminalOptions } from 'xterm';
import { ITerminalError } from './error';
import { TerminalOptions } from '../common';

export const ITerminalExternalService = Symbol('ITerminalExternalService');
export interface ITerminalExternalService {
  /**
   * 集成方自定义会话唯一标识的函数
   */
  makeId(): string;
  /**
   * 集成方自定义写入到 localStorage 的键值的函数
   */
  restore(): string;
  /**
   * 当关闭 IDE 的时候，允许集成方额外向每一个会话标识写入一个字符串字段，
   * 信息内容由集成方决定
   *
   * @param sessionId 会话唯一标识
   */
  meta(sessionId: string): string;
  /**
   * Xterm 终端的构造选项
   */
  getOptions(): ITerminalOptions;
  /**
   * 用于获取特定会话的相关信息，包括进程 id 以及进程描述的 name，
   * 这个函数允许返回为空
   *
   * @param sessionId 会话唯一标识
   */
  intro(sessionId: string): { pid: number, name: string } | undefined;
  /**
   *
   * @param id 会话唯一标识
   * @param message 发送的字符串信息
   */
  sendText(id: string, message: string): Promise<void>;
  /**
   * 检测还在会话重的终端后台是否还处于保活状态
   *
   * @param sessionIds
   */
  check?(sessionIds: string[]): Promise<boolean>;
  /**
   *
   * @param sessionId 会话唯一标识
   * @param term 返回的 Xterm 终端实例
   * @param restore 是否是恢复一个终端
   * @param meta 恢复终端所需要的额外字段
   * @param attachMethod 将 websocket 连接和 xterm 连接起来的函数
   * @param options 创建一个新终端的进程选项
   */
  attach(sessionId: string, term: Terminal, restore: boolean, meta: string, attachMethod: (s: WebSocket) => void, options?: TerminalOptions, shellType?: string): Promise<void>;
  /**
   *
   * @param sessionId 会话唯一标识
   * @param cols resize 的列数
   * @param rows resize 的行数
   */
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
  /**
   * 清理屏幕
   */
  clear?(sessionId: string): void;
  /**
   * 销毁一个终端进程
   *
   * @param sessionId 会话唯一标识
   */
  disposeById(sessionId: string): void;
  /**
   * 异步向后端获取一个会话的进程 id
   *
   * @param sessionId 会话唯一标识
   */
  getProcessId(sessionId: string): Promise<number>;

  /**
   * 报错处理的事件
   *
   * @param handler
   */
  onError(handler: (error: ITerminalError) => void): IDisposable;
}
export const terminalFocusContextKey = 'isTerminalFocused';

export const TerminalSupportType = {
  'terminal.fontFamily': 'fontFamily',
  'terminal.fontSize': 'fontSize',
  'terminal.fontWeight': 'fontWeight',
  'terminal.lineHeight': 'lineHeight',
  'terminal.cursorBlink': 'cursorBlink',
  'terminal.scrollback': 'scrollback',
};
