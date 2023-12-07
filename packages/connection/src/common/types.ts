import { MessageConnection } from '@opensumi/vscode-jsonrpc';

export type RPCServiceMethod = (...args: any[]) => any;

export type IRPCServiceMap = Record<string, RPCServiceMethod>;

export enum ServiceType {
  Service,
  Stub,
}

export const formatServiceType = (type: ServiceType) => (type === ServiceType.Service ? 'Service' : 'Stub');

export interface IBench {
  registerService: (service: string) => void;
}

export interface RPCMessageConnection extends MessageConnection {
  uid?: string;
  writer?: any;
  reader?: any;
}

export interface ILogger {
  warn(...args: any[]): void;
  log(...args: any[]): void;
}
