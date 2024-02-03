export interface ILogger {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export type RPCServiceMethod = (...args: any[]) => any;
export type IRPCServiceMap = Map<PropertyKey, RPCServiceMethod>;

export enum ServiceType {
  Service,
  Stub,
}

export interface IBench {
  registerService: (service: string) => void;
}
