import { MessageConnection } from '@opensumi/vscode-jsonrpc';

export interface ILogger {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export type RPCServiceMethod = (...args: any[]) => any;
export type IRPCServiceMap = Record<string, RPCServiceMethod>;

export enum ServiceType {
  Service,
  Stub,
}

export interface IBench {
  registerService: (service: string) => void;
}

export interface RPCMessageConnection extends MessageConnection {
  uid?: string;
  writer?: any;
  reader?: any;
}
