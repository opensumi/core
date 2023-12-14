export interface ILogger {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export type RPCServiceMethod = (...args: any[]) => any;
export type IRPCServiceMap = Record<string, RPCServiceMethod>;
