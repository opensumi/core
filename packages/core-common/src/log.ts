export enum LogLevel {
  Verbose,
  Debug,
  Info,
  Warning,
  Error,
  Critical,
  Off,
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
  App = 'app',
  // 其他未分类
  OTHER = 'other',
}

export interface SimpleLogServiceOptions {
  namespace?: string;
  pid?: number;
}

export interface Archive {
  /**
   * 将压缩的zip文件，写入流；通过该方法可以将zip文件写入本地或上传服务器
   * @param writeStream fs.WriteStream
   */
  pipe(writeStream: any);
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

  /**
   * @param day --格式为： 20190807
   */
  getLogZipArchiveByDay(day: number): Promise<Archive>;

  getLogZipArchiveByFolder(foldPath: string): Promise<Archive>;

  dispose();
}

export interface ILogService {
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;

  setOptions(options: SimpleLogServiceOptions);

  verbose(...args: any[]): void;
  debug(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  critical(...args: any[]): void;

  sendLog(level: LogLevel, message: string): void;

  /**
   * 将缓存日志罗盘
   */
  drop():Promise<void>;

  dispose(): void;
}

export const LogServiceForClientPath =  'LogServiceForClientPath';

export interface ILogServiceClient {
  getLevel():Promise<LogLevel>;
  setLevel(level: LogLevel): Promise<void>;

  verbose(...args: any[]): Promise<void>;
  debug(...args: any[]): Promise<void>;
  log(...args: any[]): Promise<void>;
  warn(...args: any[]): Promise<void>;
  error(...args: any[]): Promise<void>;
  critical(...args: any[]): Promise<void>;
  
  dispose(): Promise<void>;
}

export const ILoggerManageClient = Symbol(`ILoggerManageClient`);
export interface ILoggerManageClient {
  getLogger(namespace: SupportLogNamespace, pid?: number): ILogServiceClient;

  setGlobalLogLevel(level: LogLevel): Promise<void>;
  getGlobalLogLevel(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * 兼容旧logger 提供的类型，同 ILogServiceClient
 */
export const ILogger = Symbol('ILogger');
// tslint:disable-next-line:no-empty-interface
export interface ILogger extends ILogServiceClient {}

/** 
 * 兼容旧的logger，请尽快替换掉该方法
 */
export function getLogger(): any {
  function showWarn() {
    console.warn('getLogger方法已经废弃，请使用@ali/logs-core详见https://yuque.antfin-inc.com/zymuwz/lsxfi3/kxc235#UMDYx')
  }

  return {
    get log() {
      showWarn();
      return console.log;
    },
    get debug() {
      showWarn();
      return console.debug;
    },
    get error() {
      showWarn();
      return console.error;
    },
    get info() {
      showWarn();
      return console.info;
    },
    get warn() {
      showWarn();
      return console.warn;
    }
  }
}