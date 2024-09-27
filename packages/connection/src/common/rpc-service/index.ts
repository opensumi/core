export * from './stub';
export * from './center';
export * from './registry';

export abstract class RPCService<T = any> {
  rpcClient?: T[];
  get client(): T | undefined {
    return this.rpcClient ? this.rpcClient[0] : undefined;
  }
}
