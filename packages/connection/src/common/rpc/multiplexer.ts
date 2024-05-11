import { BaseConnection } from '../connection';
import { ExtObjectTransfer } from '../fury-extends/any';

import { ISumiConnectionOptions, SumiConnection } from './connection';
import { AnyProtocolSerializer } from './message-io';
import { TSumiProtocol } from './types';

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

export interface ISumiMultiplexerConnectionOptions extends ISumiConnectionOptions {
  /**
   * Known protocols that will be loaded automatically when a proxy is created.
   */
  knownProtocols?: Record<string, TSumiProtocol>;
}

export const IRPCProtocol = Symbol('IRPCProtocol');
export interface IRPCProtocol {
  getProxy<T>(proxyId: ProxyIdentifier<T>): T;
  set<T>(identifier: ProxyIdentifier<T>, instance: T): T;
  get<T>(identifier: ProxyIdentifier<T>): T;
}

/**
 * A connection multiplexer that allows to register multiple local RPC services and to create proxies for them.
 */
export class SumiConnectionMultiplexer extends SumiConnection implements IRPCProtocol {
  protected static SEP = '/';
  protected static SEP_LENGTH = SumiConnectionMultiplexer.SEP.length;

  protected static getRPCName(serviceId: string, methodName: string) {
    return `${serviceId}${SumiConnectionMultiplexer.SEP}${methodName}`;
  }

  protected static extractServiceAndMethod(rpcId: string): [string, string] {
    const idx = rpcId.indexOf(SumiConnectionMultiplexer.SEP);
    return [rpcId.substring(0, idx), rpcId.substring(idx + SumiConnectionMultiplexer.SEP_LENGTH)];
  }

  protected static normalizeServiceId(serviceId: string) {
    return serviceId.replace(/\//g, '_');
  }

  protected readonly _locals: Map<string, any>;
  protected readonly _proxies: Map<string, any>;
  protected _knownProtocols: Record<string, TSumiProtocol>;

  constructor(protected socket: BaseConnection<Uint8Array>, protected options: ISumiMultiplexerConnectionOptions = {}) {
    super(socket, options);
    this._locals = new Map();
    this._proxies = new Map();
    this._knownProtocols = options.knownProtocols || {};
    this.io.setAnySerializer(new AnyProtocolSerializer(this.io.writer, this.io.reader, ExtObjectTransfer));

    this.onRequestNotFound((rpcName: string, args: any[]) => this.invoke(rpcName, args));

    // call `listen` implicitly
    // compatible behavior with the RPCProtocol
    this.listen();
  }

  public set<T>(identifier: ProxyIdentifier<T>, instance: any) {
    const id = SumiConnectionMultiplexer.normalizeServiceId(identifier.serviceId);
    this._locals.set(id, instance);
    const protocol = this._knownProtocols[identifier.serviceId];
    if (protocol) {
      this.loadProtocol(id, protocol);
    }

    return instance;
  }

  public get<T>(identifier: ProxyIdentifier<T>) {
    return this._locals.get(SumiConnectionMultiplexer.normalizeServiceId(identifier.serviceId));
  }

  protected loadProtocol(rpcId: string, protocol: TSumiProtocol) {
    this.io.loadProtocol(protocol, {
      nameConverter: (str: string) => SumiConnectionMultiplexer.getRPCName(rpcId, str),
    });
  }

  public getProxy<T>(proxyId: ProxyIdentifier<T>) {
    const serviceId = SumiConnectionMultiplexer.normalizeServiceId(proxyId.serviceId);

    if (!this._proxies.has(serviceId)) {
      const protocol = this._knownProtocols[proxyId.serviceId];
      if (protocol) {
        this.loadProtocol(serviceId, protocol);
      }

      this._proxies.set(serviceId, this._createProxy(serviceId));
    }

    return this._proxies.get(serviceId);
  }

  protected _createProxy(rpcId: string) {
    const handler = {
      get: (target: any, name: string) => {
        if (typeof name === 'symbol') {
          return null;
        }
        // charCodeAt(0) === 36 means starts with $
        if (!target[name] && name.charCodeAt(0) === 36) {
          const rpcName = SumiConnectionMultiplexer.getRPCName(rpcId, name);
          target[name] = (...args: any[]) => this.sendRequest(rpcName, ...args);
        }

        return target[name];
      },
    };

    return new Proxy(Object.create(null), handler);
  }

  public async invoke(rpcName: string, args: any[]): Promise<any> {
    const [rpcId, methodName] = SumiConnectionMultiplexer.extractServiceAndMethod(rpcName);

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

  getSocket() {
    return this.socket;
  }
}
