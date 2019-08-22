import {
  LogLevel,
  SupportLogNamespace,
  SimpleLogServiceOptions,
  ILogServiceManage,
} from '@ali/ide-core-common';
export {
  LogLevel,
  SupportLogNamespace,
  SimpleLogServiceOptions,
  Archive,
  ILogServiceManage,
  ILogService,
  ILoggerManageClient,
  ILogServiceClient,
  LogServiceForClientPath,
} from '@ali/ide-core-common';

export interface ILogServiceOptions extends SimpleLogServiceOptions {
  logServiceManage: ILogServiceManage;
  namespace: string;
  logLevel?: LogLevel;
  pid?: number;
  isShowConsoleLog?: boolean;
}

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
