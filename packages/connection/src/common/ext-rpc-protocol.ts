import { Event } from '@opensumi/ide-utils/lib/event';

import { SumiConnection } from './rpc/connection';
import { ILogger } from './types';
import { WSChannel } from './ws-channel';

export class ProxyIdentifier<T = any> {
  public static count = 0;

  public readonly serviceId: string;
  public readonly countId: number;
  constructor(serviceId: string) {
    this.serviceId = serviceId;
    this.countId = ++ProxyIdentifier.count;
  }
}

export function createExtHostContextProxyIdentifier<T>(serviceId: string): ProxyIdentifier<T> {
  const identifier = new ProxyIdentifier<T>(serviceId);
  return identifier;
}
export function createMainContextProxyIdentifier<T>(identifier: string): ProxyIdentifier<T> {
  const result = new ProxyIdentifier<T>(identifier);
  return result;
}

export const IRPCProtocol = Symbol('IRPCProtocol');
export interface IRPCProtocol {
  getProxy<T>(proxyId: ProxyIdentifier<T>): T;
  set<T>(identifier: ProxyIdentifier<T>, instance: T): T;
  get<T>(identifier: ProxyIdentifier<T>): T;
}

const SEP = '/';

function getRPCName(serviceId: string, methodName: string) {
  return `${serviceId}${SEP}${methodName}`;
}

function extractServiceAndMethod(rpcId: string): [string, string] {
  const idx = rpcId.indexOf(SEP);
  return [rpcId.substring(0, idx), rpcId.substring(idx + 1)];
}

export interface IMessagePassingProtocol<T = any> {
  send(msg: T): void;
  onMessage: Event<T>;
  timeout?: number;
}

export class RPCProtocol implements IRPCProtocol {
  private readonly _locals: Map<string, any>;
  private readonly _proxies: Map<string, any>;

  private logger: ILogger;

  constructor(protected connection: SumiConnection, logger?: ILogger) {
    this._locals = new Map();
    this._proxies = new Map();
    this.logger = logger || console;

    connection.listen();

    this.connection.onRequestNotFound((rpcName: string, args: any[]) => {
      const [rpcId, methodName] = extractServiceAndMethod(rpcName);
      return this._doInvokeHandler(rpcId, methodName, args);
    });
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
          target[name] = (...args: any[]) => this.connection.sendRequest(rpcName, ...args);
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

interface RPCProtocolCreateOptions {
  timeout?: number;
}

export function createRPCProtocol(channel: WSChannel, options: RPCProtocolCreateOptions = {}): RPCProtocol {
  const connection = channel.createSumiConnection({
    timeout: options.timeout,
  });

  return new RPCProtocol(connection);
}
