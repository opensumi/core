import { BaseConnection } from '../connection';

import { ISumiConnectionOptions, SumiConnection } from './connection';

export class ProxyIdentifier<T = any> {
  public static count = 0;

  public readonly serviceId: string;
  public readonly countId: number;
  constructor(serviceId: string) {
    this.serviceId = serviceId;
    this.countId = ++ProxyIdentifier.count;
  }

  static for(serviceId: string) {
    return new ProxyIdentifier(serviceId);
  }
}

export const IRPCProtocol = Symbol('IRPCProtocol');
export interface IRPCProtocol {
  getProxy<T>(proxyId: ProxyIdentifier<T>): T;
  set<T>(identifier: ProxyIdentifier<T>, instance: T): T;
  get<T>(identifier: ProxyIdentifier<T>): T;
}

const SEP = '||';
const SEP_LENGTH = SEP.length;

export function getRPCName(serviceId: string, methodName: string) {
  return `${serviceId}${SEP}${methodName}`;
}

export function extractServiceAndMethod(rpcId: string): [string, string] {
  const idx = rpcId.indexOf(SEP);
  return [rpcId.substring(0, idx), rpcId.substring(idx + SEP_LENGTH)];
}

/**
 * A connection multiplexer that allows to register multiple local RPC services and to create proxies for them.
 */
export class SumiConnectionMultiplexer extends SumiConnection implements IRPCProtocol {
  private readonly _locals: Map<string, any>;
  private readonly _proxies: Map<string, any>;

  constructor(protected socket: BaseConnection<Uint8Array>, protected options: ISumiConnectionOptions = {}) {
    super(socket, options);
    this._locals = new Map();
    this._proxies = new Map();

    this.onRequestNotFound((rpcName: string, args: any[]) => {
      const [rpcId, methodName] = extractServiceAndMethod(rpcName);
      return this._doInvokeHandler(rpcId, methodName, args);
    });

    // call `listen` implicitly
    // compatible behavior with the RPCProtocol
    this.listen();
  }

  public set<T>(identifier: ProxyIdentifier<T>, instance: any) {
    this._locals.set(identifier.serviceId, instance);
    return instance;
  }

  public get<T>(identifier: ProxyIdentifier<T>) {
    return this._locals.get(identifier.serviceId);
  }

  public getProxy<T>(proxyId: ProxyIdentifier<T>) {
    if (!this._proxies.has(proxyId.serviceId)) {
      this._proxies.set(proxyId.serviceId, this._createProxy(proxyId.serviceId));
    }

    return this._proxies.get(proxyId.serviceId);
  }

  private _createProxy(rpcId: string) {
    const handler = {
      get: (target: any, name: string) => {
        if (typeof name === 'symbol') {
          return null;
        }
        // charCodeAt(0) === 36 means starts with $
        if (!target[name] && name.charCodeAt(0) === 36) {
          const rpcName = getRPCName(rpcId, name);
          target[name] = (...args: any[]) => this.sendRequest(rpcName, ...args);
        }

        return target[name];
      },
    };

    return new Proxy(Object.create(null), handler);
  }

  private async _doInvokeHandler(rpcId: string, methodName: string, args: any[]): Promise<any> {
    const actor = this._locals.get(rpcId);
    if (!actor) {
      throw new Error('Unknown actor ' + rpcId);
    }
    const method = await actor[methodName];
    if (typeof method !== 'function') {
      throw new Error('Unknown method ' + methodName + ' on actor ' + rpcId);
    }

    return method.apply(actor, args);
  }
}
