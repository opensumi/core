import { BaseConnection } from '../connection';
import { ExtObjectTransfer } from '../fury-extends/any';

import { ISumiConnectionOptions, SumiConnection } from './connection';
import { AnyProtocolSerializer, MessageIO } from './message-io';
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

export const IRPCProtocol = Symbol('IRPCProtocol');
export interface IRPCProtocol {
  getProxy<T>(proxyId: ProxyIdentifier<T>): T;
  set<T>(identifier: ProxyIdentifier<T>, instance: T): T;
  get<T>(identifier: ProxyIdentifier<T>): T;
}

/**
 *
 * @param protocols Known protocols that will be loaded automatically when a proxy is created.
 * @returns
 */
export function createExtMessageIO(protocols?: Map<ProxyIdentifier<any>, TSumiProtocol>) {
  const io = new MessageIO();
  io.setAnySerializer(new AnyProtocolSerializer(io.writer, io.reader, ExtObjectTransfer));

  protocols?.forEach((protocol, proxyId) => {
    io.loadProtocol(protocol, {
      nameConverter: (str: string) => SumiConnectionMultiplexer.getRPCName(proxyId.serviceId, str),
    });
  });

  return io;
}

/**
 * A connection multiplexer that allows to register multiple local RPC services and to create proxies for them.
 */
export class SumiConnectionMultiplexer extends SumiConnection implements IRPCProtocol {
  protected static SEP = '/';
  protected static SEP_LENGTH = SumiConnectionMultiplexer.SEP.length;

  static getRPCName(serviceId: string, methodName: string) {
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

  io: MessageIO;

  constructor(protected socket: BaseConnection<Uint8Array>, protected options: ISumiConnectionOptions = {}) {
    super(socket, {
      ...options,
      io: options.io || createExtMessageIO(),
    });
    this._locals = new Map();
    this._proxies = new Map();

    this.onRequestNotFound((rpcName: string, args: any[]) => this.invoke(rpcName, args));

    // call `listen` implicitly
    // compatible behavior with the RPCProtocol
    this.listen();
  }

  public set<T>(identifier: ProxyIdentifier<T>, instance: any) {
    const id = SumiConnectionMultiplexer.normalizeServiceId(identifier.serviceId);
    this._locals.set(id, instance);

    return instance;
  }

  public get<T>(identifier: ProxyIdentifier<T>) {
    return this._locals.get(SumiConnectionMultiplexer.normalizeServiceId(identifier.serviceId));
  }

  public getProxy<T>(proxyId: ProxyIdentifier<T>) {
    const serviceId = SumiConnectionMultiplexer.normalizeServiceId(proxyId.serviceId);

    if (!this._proxies.has(serviceId)) {
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
        if (!target[name]) {
          if (name.charCodeAt(0) === 36) {
            const rpcName = SumiConnectionMultiplexer.getRPCName(rpcId, name);
            target[name] = (...args: any[]) => this.sendRequest(rpcName, ...args);
          } else if (name === 'toJSON') {
            target[name] = () => {
              throw new Error('Cannot serialize a rpc protocol proxy object');
            };
          }
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
