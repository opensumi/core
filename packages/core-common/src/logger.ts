export interface ILogger {

  error(...args: any[]): void;

  warn(...args: any[]): void;

  log(...args: any[]): void;

  debug(...args: any[]): void;

  info(...args: any[]): void;

}

export const ILogger = Symbol('ILogger');

let logger:ILogger = console;

export function getLogger() {
  return logger;
}

// TODO setLogger

