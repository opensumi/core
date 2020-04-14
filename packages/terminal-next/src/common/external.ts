import { IDisposable } from '@ali/ide-core-common';
import { ITerminalOptions, Terminal } from 'xterm';
import { ITerminalError } from './error';
import { TerminalOptions } from './pty';
import { ITerminalConnection } from './client';

export const ITerminalExternalService = Symbol('ITerminalExternalService');
export interface ITerminalExternalService {
  /**
   * 自定义 sessionId
   */
  generateSessionId?(): string;
  /**
   * Xterm 终端的构造选项，
   * 默认返回为 {}
   */
  getOptions?(): ITerminalOptions;
  /**
   * 检测还在会话中的终端后台是否还处于保活状态，
   * 默认返回为 true
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
  attach(sessionId: string, xterm: Terminal, options?: TerminalOptions, shellType?: string): Promise<ITerminalConnection | undefined>;
  /**
   *
   * @param id 会话唯一标识
   * @param message 发送的字符串信息
   */
  sendText(id: string, message: string): Promise<void>;
  /**
   *
   * @param sessionId 会话唯一标识
   * @param cols resize 的列数
   * @param rows resize 的行数
   */
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
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

export const ITerminalInternalService = Symbol('ITerminalInternalService');
export interface ITerminalInternalService extends ITerminalExternalService {
  generateSessionId(): string;
  getOptions(): ITerminalOptions;
  check(sessionIds: string[]): Promise<boolean>;
}

export const TerminalSupportType = {
  'terminal.fontFamily': 'fontFamily',
  'terminal.fontSize': 'fontSize',
  'terminal.fontWeight': 'fontWeight',
  'terminal.lineHeight': 'lineHeight',
  'terminal.cursorBlink': 'cursorBlink',
  'terminal.scrollback': 'scrollback',
};
