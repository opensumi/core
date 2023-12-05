export interface ILogger {
  warn(...args: any[]): void;
  log(...args: any[]): void;
}

export abstract class RPCService<T = any> {
  setConnectionClientId?(clientId: string): void;
  rpcClient?: T[];
  rpcRegistered?: boolean;
  register?(): () => Promise<T>;
  get client() {
    return this.rpcClient ? this.rpcClient[0] : undefined;
  }
}
