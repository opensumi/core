export interface ILogger {

  error(...args: any[]): void;

  warn(...args: any[]): void;

  log(...args: any[]): void;

  debug(...args: any[]): void;

}

let logger:ILogger = console;

export function getLogger() {
  return logger;
}

// TODO setLogger

