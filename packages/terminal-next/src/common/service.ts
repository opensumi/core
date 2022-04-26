import { ITerminalOptions as IXtermTerminalOptions, Terminal } from 'xterm';

import { IDisposable, OperatingSystem } from '@opensumi/ide-core-common';

import { ITerminalConnection } from './client';
import { ITerminalError } from './error';
import { ITerminalProfile } from './profile';
import { IShellLaunchConfig, TerminalOptions } from './pty';
import { IXTerm } from './xterm';

export interface IPtyExitEvent {
  sessionId: string;
  code?: number;
  signal?: number;
}

export interface IPtyProcessChangeEvent {
  sessionId: string;
  processName: string;
}

export const ITerminalService = Symbol('ITerminalService');
export interface ITerminalService {
  /**
   * 自定义 sessionId
   */
  generateSessionId?(): string;
  /**
   * Xterm 终端的构造选项，
   * 默认返回为 {}
   */
  getOptions?(): IXtermTerminalOptions;
  /**
   * 检测还在会话中的终端后台是否还处于保活状态，
   * 默认返回为 true
   *
   * @param sessionIds
   */
  check?(sessionIds: string[]): Promise<boolean>;

  /**
   * @param sessionId 会话唯一标识
   * @param rows 终端初始化使用的列数
   * @param cols 终端初始化使用的行数
   * @param launchConfig 创建一个新终端的进程选项
   * @param xterm 创建的 xterm 实例
   */
  attachByLaunchConfig(
    sessionId: string,
    cols: number,
    rows: number,
    launchConfig: IShellLaunchConfig,
    xterm?: IXTerm,
  ): Promise<ITerminalConnection | undefined>;
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
  getProcessId(sessionId: string): Promise<number | undefined>;
  /**
   * 报错处理的事件
   *
   * @param handler
   */
  onError(handler: (error: ITerminalError) => void): IDisposable;
  /**
   * 终端正常退出
   *
   * @param sessionid
   */
  onExit(handler: (event: IPtyExitEvent) => void): IDisposable;

  onProcessChange(handler: (event: IPtyProcessChangeEvent) => void): IDisposable;

  /**
   * 返回终端环境的 OS
   */
  getOS(): Promise<OperatingSystem>;
  getProfiles(autoDetect: boolean): Promise<ITerminalProfile[]>;
  getDefaultSystemShell(): Promise<string>;
  getCodePlatformKey(): Promise<'osx' | 'windows' | 'linux'>;
}

export const ITerminalInternalService = Symbol('ITerminalInternalService');
export interface ITerminalInternalService extends ITerminalService {
  generateSessionId(): string;
  getOptions(): IXtermTerminalOptions;
  check(sessionIds: string[]): Promise<boolean>;
}
