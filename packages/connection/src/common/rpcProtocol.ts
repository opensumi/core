import {
  CancellationToken,
  CancellationTokenSource,
  Deferred,
  Event,
  SerializedError,
  // Uri: vscode 中的 uri
  // URI: 在 vscode 中的 uri 基础上包装了一些基础方法
  Uri,
  transformErrorForSerialization,
} from '@opensumi/ide-core-common';

import { IRPCProtocol, ProxyIdentifier } from './rpc/multiplexer';

export enum RPCProtocolEnv {
  MAIN,
  EXT,
}

export interface IProxyIdentifier {
  serviceId: string;
  countId: number;
}

export { IRPCProtocol, ProxyIdentifier };

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
  timeout?: number;
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
interface CancelMessage {
  type: MessageType.Cancel;
  id: string;
}

interface ReplyMessage {
  type: MessageType.Reply;
  id: string;
  res: any;
}

interface ErrorMessage {
  type: MessageType.Cancel;
  id: string;
  res: SerializedError;
}

export namespace ObjectTransfer {
  export function replacer(key: string | undefined, value: any) {
    if (value) {
      if (value.$mid === 1) {
        const uri = Uri.revive(value);
        return {
          $type: 'VSCODE_URI',
          data: uri.toString(),
        };
      } else if (value instanceof Uint8Array || value instanceof Uint32Array || value instanceof Uint16Array) {
        return {
          $type: 'Buffer',
          data: Array.from(value),
        };
      } else if (value instanceof ArrayBuffer) {
        return {
          $type: 'Buffer',
          data: Array.from(new Uint8Array(value)),
        };
      } else if (value.type === 'Buffer') {
        // https://nodejs.org/api/buffer.html#buftojson
        return {
          $type: 'Buffer',
          data: value.data,
        };
      }
    }

    return value;
  }
  export function reviver(key: string | undefined, value: any) {
    if (value && value.$type !== undefined && value.data !== undefined) {
      if (value.$type === 'VSCODE_URI') {
        return Uri.parse(value.data);
      }
      if (value.$type === 'Buffer') {
        return Uint8Array.from(value.data);
      }
    }
    return value;
  }
}

export class MessageIO {
  public static cancel(req: string, messageToSendHostId?: string): string {
    return `{"type":${MessageType.Cancel},"id":"${req}"}`;
  }

  public static serializeRequest(callId: string, rpcId: string, method: string, args: any[]): string {
    args = args.map((arg) => {
      if (arg instanceof Error) {
        // 处理 Error 类型的参数
        // eslint-disable-next-line prefer-rest-params
        const array = Array.prototype.slice.call(arguments) as any[];
        array[0] = arg.stack;
        return array.join('\n');
      }
      return arg;
    });

    return `{"type": ${
      MessageType.Request
    }, "id": "${callId}", "proxyId": "${rpcId}", "method": "${method}", "args": ${JSON.stringify(
      args,
      ObjectTransfer.replacer,
    )}}`;
  }
  public static serializeReplyOK(callId: string, res: any, logger?: any): string {
    if (typeof res === 'undefined') {
      return `{"type": ${MessageType.Reply}, "id": "${callId}"}`;
    } else {
      try {
        return `{"type": ${MessageType.Reply}, "id": "${callId}", "res": ${JSON.stringify(
          res,
          ObjectTransfer.replacer,
        )}}`;
      } catch (e) {
        if (logger) {
          logger.warn('res', res);
        }
        return `{"type": ${MessageType.Reply}, "id": "${callId}", "res": {}}`;
      }
    }
  }
  public static serializeReplyError(callId: string, error: Error, logger?: any): string {
    try {
      return `{"type": ${MessageType.ReplyErr}, "id": "${callId}", "res": ${JSON.stringify(
        transformErrorForSerialization(error),
        ObjectTransfer.replacer,
      )}}`;
    } catch (e) {
      if (logger) {
        logger.error('error', error);
      }
      return `{"type": ${MessageType.ReplyErr}, "id": "${callId}", "res": {}}`;
    }
  }
}

function canceled(): Error {
  const error = new Error('Canceled');
  error.name = error.message;
  return error;
}

/**
 * @deprecated Please use `SumiConnectionMultiplexer` instead.
 */
export class RPCProtocol implements IRPCProtocol {
  private readonly _protocol: IMessagePassingProtocol;
  private readonly _locals: Map<string, any>;
  private readonly _proxies: Map<string, any>;
  private readonly _cancellationTokenSources: Map<string, CancellationTokenSource>;
  private readonly _timeoutHandles: Map<string, NodeJS.Timeout | number>;
  private _lastMessageId: number;
  private _pendingRPCReplies: Map<string, Deferred<any>>;
  private logger;

  constructor(connection: IMessagePassingProtocol, logger?: any) {
    this._protocol = connection;
    this._locals = new Map();
    this._proxies = new Map();
    this._pendingRPCReplies = new Map();
    this._cancellationTokenSources = new Map();
    this._timeoutHandles = new Map();

    this._lastMessageId = 0;
    this.logger = logger || console;
    this.logger.error(
      "You are using the deprecated class: 'RPCProtocol'. Please use the new one: 'SumiConnectionMultiplexer'",
    );
    this._protocol.onMessage((msg) => this._receiveOneMessage(msg));
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
        if (!target[name] && name.charCodeAt(0) === 36) {
          target[name] = (...myArgs: any[]) => this._remoteCall(rpcId, name, myArgs);
        }

        return target[name];
      },
    };

    return new Proxy(Object.create(null), handler);
  }

  private _remoteCall(rpcId: string, methodName: string, args: any[]): Promise<any> {
    const cancellationToken: CancellationToken | undefined =
      args.length && CancellationToken.isCancellationToken(args[args.length - 1]) ? args.pop() : undefined;
    if (cancellationToken && cancellationToken.isCancellationRequested) {
      return Promise.reject(canceled());
    }

    const callId = String(++this._lastMessageId);
    const result = new Deferred();

    if (cancellationToken) {
      args.push('add.cancellation.token');
      cancellationToken.onCancellationRequested(() => this._protocol.send(MessageIO.cancel(callId)));
    }
    this._pendingRPCReplies.set(callId, result);
    const msg = MessageIO.serializeRequest(callId, rpcId, methodName, args);

    this._protocol.send(msg);
    // 设置超时回调, -1 即不配置超时时间
    if (this._protocol.timeout && this._protocol.timeout !== -1) {
      const timeoutHandle = setTimeout(() => {
        this._handleTimeout(callId);
      }, this._protocol.timeout);
      this._timeoutHandles.set(callId, timeoutHandle);
    }

    return result.promise;
  }

  private _receiveOneMessage(rawmsg: string): void {
    const msg = JSON.parse(rawmsg, ObjectTransfer.reviver);

    if (this._timeoutHandles.has(msg.id)) {
      // 忽略一些 jest 测试场景 clearTimeout not defined 的问题
      if (typeof clearTimeout === 'function') {
        // @ts-ignore
        clearTimeout(this._timeoutHandles.get(msg.id));
      }
      this._timeoutHandles.delete(msg.id);
    }

    switch (msg.type) {
      case MessageType.Request:
        this._receiveRequest(msg);
        break;
      case MessageType.Reply:
        this._receiveReply(msg);
        break;
      case MessageType.Cancel:
        this._receiveCancel(msg);
        break;
      case MessageType.ReplyErr:
        this._receiveError(msg);
        break;
    }
  }
  private _receiveCancel(msg: CancelMessage) {
    const cancellationTokenSource = this._cancellationTokenSources.get(msg.id);
    if (cancellationTokenSource) {
      cancellationTokenSource.cancel();
    }
  }

  private _receiveError(msg: ErrorMessage) {
    const callId = msg.id;
    if (!this._pendingRPCReplies.has(callId)) {
      return;
    }

    const pendingReply = this._pendingRPCReplies.get(callId) as Deferred<any>;
    this._pendingRPCReplies.delete(callId);

    let err: any;
    if (msg.res) {
      if (msg.res.$isError) {
        err = new Error();
        err.name = msg.res.name;
        err.message = msg.res.message;
        err.stack = msg.res.stack;
      } else {
        err = msg.res;
      }
    }
    pendingReply.reject(err);
  }

  private _receiveRequest(msg: RequestMessage): void {
    const callId = msg.id;
    const rpcId = msg.proxyId;
    const method = msg.method;
    const args = msg.args.map((arg) => (arg === null ? undefined : arg));

    const addToken = args.length && args[args.length - 1] === 'add.cancellation.token' ? args.pop() : false;
    if (addToken) {
      const tokenSource = new CancellationTokenSource();
      this._cancellationTokenSources.set(callId, tokenSource);
      args.push(tokenSource.token);
    }

    const promise = this._invokeHandler(rpcId, method, args);
    promise
      .then((r) => {
        this._protocol.send(MessageIO.serializeReplyOK(callId, r));
        this._cancellationTokenSources.delete(callId);
      })
      .catch((err) => {
        this._protocol.send(MessageIO.serializeReplyError(callId, err));
        this._cancellationTokenSources.delete(callId);
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
      throw new Error('Unknown method ' + methodName + ' on actor ' + rpcId);
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
  private _handleTimeout(callId: string) {
    if (!this._pendingRPCReplies.has(callId) || !this._timeoutHandles.has(callId)) {
      return;
    }

    const pendingReply = this._pendingRPCReplies.get(callId) as Deferred<any>;
    this._pendingRPCReplies.delete(callId);
    this._timeoutHandles.delete(callId);

    pendingReply.reject(new Error('RPC Timeout: ' + callId));
  }
}
