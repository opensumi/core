export * from './fury-rpc';
export * from '../constants';
export * from './base';
export * from './json-rpc';
export * from './proxy-client';

export abstract class RPCService<T = any> {
  setConnectionClientId?(clientId: string): void;
  rpcClient?: T[];
  rpcRegistered?: boolean;
  register?(): () => Promise<T>;
  get client() {
    return this.rpcClient ? this.rpcClient[0] : undefined;
  }
}
