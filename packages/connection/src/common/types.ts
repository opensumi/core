export interface ILogger {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export type RPCServiceMethod = (...args: any[]) => any;
export type IRPCServiceMap = Record<PropertyKey, RPCServiceMethod>;

export enum ServiceType {
  Service,
  Stub,
}

export interface IBench {
  registerService: (service: string) => void;
}

export interface WSCloseInfo {
  channelPath: string;
  closeEvent: { code: number; reason: string };
  connectInfo: ConnectionInfo;
}

export interface ConnectionInfo {
  type: string;
  downlink: number;
  uplink: number;
  rtt: number;
}
