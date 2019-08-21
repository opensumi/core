import * as fs from 'fs';
import { LogLevel } from '@ali/ide-core-common';
export { LogLevel } from '@ali/ide-core-common';

export interface GlobalLogConfig {
  // 默认为 LogLevel.Info
  logLevel?: LogLevel;
  // 设置log目录的绝对路径，默认为 ~/.kaitian/logs/
  logRootFolder?: string;
}

export enum SupportLogNamespace {
  // 主进程
  Main = 'main',
  // 渲染进程
  Render = 'render',
  // Node进程
  Node = 'node',
  // 浏览器进程
  Browser = 'browser',
  // 插件进程
  ExtensionHost = 'extHost',
  // 应用层
  App = 'App',
  // 其他未分类
  OTHER = 'other',
}

export interface ILogService {
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;

  setOptions(options: SimpleLogServiceOptions);

  verbose(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  log(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string | Error, ...args: any[]): void;
  critical(message: string | Error, ...args: any[]): void;

  sendLog(level: LogLevel, message: string): void;

  dispose(): void;
}

export const ILogServiceManage = Symbol('ILogServiceManage');
export interface ILogServiceManage {
  getLogger(namespace: SupportLogNamespace, loggerOptions?: SimpleLogServiceOptions): ILogService;
  getGlobalLogLevel(): LogLevel;
  removeLogger(namespace: SupportLogNamespace);
  setGlobalLogLevel(level: LogLevel);

  /**
   * 返回当前日志存放的目录
   */
  getLogFolder(): string;

  /**
   * 返回保存日志的根目录，为 getLogFolder() 的父目录
   */
  getRootLogFolder(): string;

  /**
   * 清理 getRootLogFolder() 中最近5天前的日志，仅保留最近5天日志
   */
  cleanOldLogs(): Promise<void>;

  /**
   * 清理 getRootLogFolder() 中的所有日志
   */
  cleanAllLogs(): Promise<void>;

  /**
   * 清理 day 之前的日志目录
   * @param day --格式为： 20190807
   */
  cleanExpiredLogs(day: number): Promise<void>;

  getLogZipArchiveByDay(day: number): Archive;

  getLogZipArchiveByFolder(foldPath: string): Archive;

  dispose();
}

export interface SimpleLogServiceOptions {
  namespace?: string;
  logLevel?: LogLevel;
  pid?: number;
  isShowConsoleLog?: boolean;
}

export interface ILogServiceOptions extends SimpleLogServiceOptions {
  logServiceManage: ILogServiceManage;
  namespace: string;
  logLevel?: LogLevel;
  pid?: number;
  isShowConsoleLog?: boolean;
}

export const LogServiceForClientPath =  'LogServiceForClient';
export const ILogServiceForClient = Symbol('LogServiceForClient');

export interface ILogServiceForClient {
  getLevel(namespace: SupportLogNamespace): LogLevel;
  setLevel(namespace: SupportLogNamespace, level: LogLevel): void;

  verbose(namespace: SupportLogNamespace, message: string, pid?: number): void;
  debug(namespace: SupportLogNamespace, message: string, pid?: number): void;
  log(namespace: SupportLogNamespace, message: string, pid?: number): void;
  warn(namespace: SupportLogNamespace, message: string, pid?: number): void;
  error(namespace: SupportLogNamespace, message: string, pid?: number): void;
  critical(namespace: SupportLogNamespace, message: string, pid?: number): void;

  dispose(namespace: SupportLogNamespace): void;

  setGlobalLogLevel(level: LogLevel);
  getGlobalLogLevel();
  disposeAll();
}

export interface LoggerManageInitOptions {
  logDir?: string;
  logLevel?: LogLevel;
}

export interface Archive {
  // 将压缩的zip文件，写入流；同过该方法可以将zip文件写入本地或上传服务器
  pipe(writeStream: fs.WriteStream);
}

export function format(args: any): string {
  let result = '';

  for (let i = 0; i < args.length; i++) {
    let a = args[i];

    if (typeof a === 'object') {
      try {
        a = JSON.stringify(a);
      } catch (e) { }
    }

    result += (i > 0 ? ' ' : '') + a;
  }

  return result;
}
