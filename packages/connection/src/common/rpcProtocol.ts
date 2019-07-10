import {Event, Deferred} from '@ali/ide-core-common';

export enum RPCProtocolEnv {
  MAIN,
  EXT,
}

export class ProxyIdentifier<T> {
  public static count = 0;

  public readonly serviceId: string;
  public readonly countId: number;
  // TODO: 增加 env 标识
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
export interface IMessagePassingProtocol {
  send(msg): void;
  onMessage: Event<string>;
}

const enum MessageType {
  Request = 1,
  Reply = 2,
  ReplyErr = 3,
  Cancel = 4,
}

interface RequestMessage {
  type: MessageType.Request;
  id: string;
  proxyId: string;
  method: string;
  args: any[];
}

interface ReplyMessage {
  type: MessageType.Reply;
  id: string;
  res: any;
}

export namespace ObjectTransfer {
  export function replacer(key: string | undefined, value: any ) {
    return value;
  }
  export function reviver(key: string | undefined, value: any) {
    return value;
  }
}

export class MessageIO {
  public static serializeRequest(callId: string, rpcId: string, method: string, args: any[]): string {
    return `{"type": ${MessageType.Request}, "id": "${callId}", "proxyId": "${rpcId}", "method": "${method}", "args": ${JSON.stringify(args, ObjectTransfer.replacer)}}`;
  }
  public static serializeReplyOK(callId: string, res: any): string {
    if (typeof res === 'undefined') {
      return `{"type": ${MessageType.Reply}, "id": "${callId}"}`;
    } else {
      return `{"type": ${MessageType.Reply}, "id": "${callId}", "res": ${JSON.stringify(res, ObjectTransfer.replacer)}}`;
    }
  }
}

export interface IRPCProtocol {
  getProxy<T>(proxyId: ProxyIdentifier<T>): T;
  set<T>(identifier: ProxyIdentifier<T>, instance: T): T;
}

export class RPCProtocol implements IRPCProtocol {
  private readonly _protocol: IMessagePassingProtocol;
  private readonly _locals: Map<string, any>;
  private readonly _proxies: Map<string, any>;
  private _lastMessageId: number;
  private _pendingRPCReplies: Map<string, Deferred<any>>;

  constructor(connection: IMessagePassingProtocol) {
    this._protocol = connection;
    this._locals = new Map();
    this._proxies = new Map();
    this._pendingRPCReplies = new Map();

    this._lastMessageId = 0;
    this._protocol.onMessage( (msg) => this._receiveOneMessage(msg));
  }

  public set<T>(identifier: ProxyIdentifier<T>, instance: any) {
    this._locals.set(identifier.serviceId, instance);
    return instance;
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
        if (!target[name] && name.charCodeAt(0) === 36) {
          target[name] = (...myArgs: any[]) => {
            return this._remoteCall(rpcId, name, myArgs);
          };
        }

        return target[name];
      },
    };

    return new Proxy(Object.create(null), handler);
  }

  private _remoteCall(rpcId: string, methodName: string, args: any[]): Promise<any> {
    const callId = String(++this._lastMessageId);
    const result = new Deferred();
    this._pendingRPCReplies.set(callId, result);
    const msg = MessageIO.serializeRequest(callId, rpcId, methodName, args);

    this._protocol.send(msg);
    return result.promise;
  }

  private _receiveOneMessage(rawmsg: string): void {
    const msg = JSON.parse(rawmsg, ObjectTransfer.reviver);

    switch (msg.type) {
      case MessageType.Request:
        this._receiveRequest(msg);
        break;
      case MessageType.Reply:
        this._receiveReply(msg);
    }
  }
  private _receiveRequest(msg: RequestMessage): void {
    const callId = msg.id;
    const rpcId = msg.proxyId;
    const method = msg.method;
    const args = msg.args.map((arg) => arg === null ? undefined : arg);

    const promise = this._invokeHandler(rpcId, method, args);
    promise.then((r) => {
      this._protocol.send(MessageIO.serializeReplyOK(callId, r));
    });

  }
  private _invokeHandler(rpcId: string, methodName: string, args: any[]) {
    try {
      return this._doInvokeHandler(rpcId, methodName, args);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  private async _doInvokeHandler(rpcId: string, methodName: string, args: any[]): Promise<any> {
    const actor = this._locals.get(rpcId);
    if (!actor) {
      throw new Error('Unknown actor ' + rpcId);
    }
    const method = await actor[methodName];
    if (typeof method !== 'function') {
      throw new Error('Unknown method ' + methodName + 'on actor' + rpcId);
    }

    return method.apply(actor, args);
  }
  private _receiveReply(msg: ReplyMessage) {
    const callId = msg.id;
    if (!this._pendingRPCReplies.has(callId)) {
      return;
    }

    const pendingReply = this._pendingRPCReplies.get(callId) as Deferred<any>;
    this._pendingRPCReplies.delete(callId);

    pendingReply.resolve(msg.res);
  }
}
