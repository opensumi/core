export * from './legacy';
export * from './runner';
export * from './sumi';
export * from './invoker';

export abstract class RPCService<T = any> {
  rpcClient?: T[];
  rpcRegistered?: boolean;
  register?(): () => Promise<T>;
  get client() {
    return this.rpcClient ? this.rpcClient[0] : undefined;
  }
}
