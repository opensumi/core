import { LogLevel, SupportLogNamespace } from '@opensumi/ide-core-common';

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

  disposeLogger(namespace: SupportLogNamespace): Promise<void>;

  setGlobalLogLevel(level: LogLevel): Promise<void>;
  getGlobalLogLevel(): Promise<LogLevel>;
  disposeAll(): Promise<void>;

  getLogFolder(): Promise<string>;
}

export interface LoggerManagerInitOptions {
  logDir?: string;
  logLevel?: LogLevel;
}

export function format(args: any): string {
  let result = '';

  for (let i = 0; i < args.length; i++) {
    let a = args[i];

    if (a instanceof Error) {
      const array = Array.prototype.slice.call(arguments) as any[];
      array[0] = a.stack;
      a = format(array);
    } else if (typeof a === 'object') {
      try {
        a = JSON.stringify(a);
      } catch (e) {}
    } else if (typeof a === 'symbol') {
      try {
        a = a.toString();
      } catch (e) {}
    }

    result += (i > 0 ? ' ' : '') + a;
  }

  return result;
}
