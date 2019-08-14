export enum SupportLogNamespace {
  Node = 'Node',
  Browser = 'Browser',
  ExtensionHost = 'ExtensionHost',
  OTHER = 'Other',
}

export enum LogLevel {
  Trace,
  Debug,
  Info,
  Warning,
  Error,
  Critical,
  Off,
}

export interface ILogService {
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;

  trace(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string | Error, ...args: any[]): void;
  critical(message: string | Error, ...args: any[]): void;

  dispose(): void;
}

export interface ILogServiceManage {
  getLogger(namespace: SupportLogNamespace): ILogService;
  getGlobalLogLevel(): LogLevel;
  removeLogger(namespace: SupportLogNamespace);
  setGlobalLogLevel(level: LogLevel);
  getLogFolder(): string;
  cleanOldLogs(): Promise<void>;
}

export interface ILogServiceOptions {
  logServiceManage: ILogServiceManage;
  namespace: string;
  logLevel?: LogLevel;
}

export const LogServicePath =  'LogService';
