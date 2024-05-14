import { Type } from '@furyjs/fury';

import { EventEmitter } from '@opensumi/events';
import {
  DisposableCollection,
  DisposableStore,
  EventQueue,
  StateTracer,
  randomString,
} from '@opensumi/ide-core-common';

import { IConnectionShape } from './connection/types';
import { oneOf } from './fury-extends/one-of';
import { ISumiConnectionOptions, SumiConnection } from './rpc/connection';
import { ILogger } from './types';

/**
 * `ping` and `pong` are used to detect whether the connection is alive.
 */
export interface PingMessage {
  kind: 'ping';
  id: string;
  clientId: string;
}

/**
 * when server receive a `ping` message, it should reply a `pong` message, vice versa.
 */
export interface PongMessage {
  kind: 'pong';
  id: string;
  clientId: string;
}

/**
 * `data` message indicate that the channel has received some data.
 * the `content` field is the data, it should be a string.
 */
export interface DataMessage {
  kind: 'data';
  id: string;
  content: string;
}

export interface BinaryMessage {
  kind: 'binary';
  id: string;
  binary: Uint8Array;
}

export interface CloseMessage {
  kind: 'close';
  id: string;
  code: number;
  reason: string;
}

export interface IWSChannelCreateOptions {
  /**
   * every channel's unique id, it only used in client to server architecture.
   * server will store this id and use it to identify which channel should be used.
   */
  id: string;
  logger?: ILogger;

  ensureServerReady?: boolean;
}

export class WSChannel {
  protected _disposables = new DisposableStore();
  protected emitter = this._disposables.add(
    new EventEmitter<{
      message: [data: string];
      open: [id: string];
      reopen: [];
      close: [code?: number, reason?: string];
      binary: [data: Uint8Array];
    }>(),
  );

  protected onBinaryQueue = this._disposables.add(new EventQueue<Uint8Array>());

  protected sendQueue: Uint8Array[] = [];
  protected _isServerReady = false;
  protected _ensureServerReady: boolean | undefined;

  public id: string;

  public channelPath: string;

  logger: ILogger = console;

  static forClient(connection: IConnectionShape<Uint8Array>, options: IWSChannelCreateOptions) {
    const disposable = new DisposableCollection();
    const channel = new WSChannel(connection, options);

    disposable.push(
      connection.onMessage((data) => {
        channel.dispatch(parse(data));
      }),
    );

    connection.onceClose(() => {
      disposable.dispose();
    });

    return channel;
  }

  constructor(public connection: IConnectionShape<Uint8Array>, options: IWSChannelCreateOptions) {
    const { id, logger, ensureServerReady } = options;
    this.id = id;

    if (logger) {
      this.logger = logger;
    }

    this._ensureServerReady = Boolean(ensureServerReady);

    this._disposables.add(this.emitter.on('binary', (data) => this.onBinaryQueue.push(data)));
  }

  protected inqueue(data: Uint8Array) {
    if (this._ensureServerReady && !this._isServerReady) {
      if (!this.sendQueue) {
        this.sendQueue = [];
      }
      this.sendQueue.push(data);
      return;
    }
    this.connection.send(data);
  }

  onMessage(cb: (data: string) => any) {
    return this.emitter.on('message', cb);
  }
  onBinary(cb: (data: Uint8Array) => any) {
    return this.onBinaryQueue.on(cb);
  }
  onOpen(cb: (id: string) => void) {
    return this.emitter.on('open', cb);
  }
  onReopen(cb: () => void) {
    return this.emitter.on('reopen', cb);
  }

  pause() {
    this._isServerReady = false;
  }

  onServerReady(cb: () => void) {
    if (this._isServerReady) {
      cb();
      return;
    }
    return this.emitter.on('open', cb);
  }

  resume() {
    this._isServerReady = true;
    if (this.sendQueue) {
      for (const item of this.sendQueue) {
        this.connection.send(item);
      }
      this.sendQueue = [];
    }
  }

  dispatch(msg: ChannelMessage) {
    switch (msg.kind) {
      case 'server-ready':
        this.stateTracer.fulfill(msg.token);
        this.resume();
        if (this.timer) {
          clearTimeout(this.timer);
        }
        this.emitter.emit('open', msg.id);
        break;
      case 'data':
        this.emitter.emit('message', msg.content);
        break;
      case 'binary':
        this.emitter.emit('binary', msg.binary);
        break;
    }
  }

  stateTracer = new StateTracer();

  /**
   * @param connectionToken 一个 connection token 用于在全链路中追踪一个 channel 的生命周期，防止 channel 被重复打开
   */
  open(path: string, clientId: string, connectionToken = randomString(16)) {
    this.channelPath = path;

    if (this.stateTracer.has(connectionToken)) {
      this.logger.warn(
        `channel already opened or in progress, path: ${path}, clientId: ${clientId}, connectionToken: ${connectionToken}`,
      );
      return;
    }

    this.stateTracer.record(connectionToken);

    this.connection.send(
      stringify({
        kind: 'open',
        id: this.id,
        path,
        clientId,
        connectionToken,
      }),
    );

    if (this._ensureServerReady) {
      this.ensureOpenSend(path, clientId, connectionToken);
    }

    return connectionToken;
  }

  protected timer: NodeJS.Timeout;
  /**
   * 启动定时器，确保 server-ready 消息在一定时间内到达
   */
  protected ensureOpenSend(path: string, clientId: string, connectionToken: string) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      if (this._isServerReady) {
        return;
      }
      this.stateTracer.delete(connectionToken);
      this.open(path, clientId, connectionToken);
    }, 500);
  }

  send(content: string) {
    this.inqueue(
      stringify({
        kind: 'data',
        id: this.id,
        content,
      }),
    );
  }

  sendBinary(data: Uint8Array) {
    this.inqueue(
      stringify({
        kind: 'binary',
        id: this.id,
        binary: data,
      }),
    );
  }
  onError() {}
  close(code?: number, reason?: string) {
    this.pause();
    this.emitter.emit('close', code, reason);
  }
  fireReopen() {
    this.emitter.emit('reopen');
  }
  onClose(cb: (code: number, reason: string) => void) {
    return this.emitter.on('close', cb);
  }
  onceClose(cb: (code: number, reason: string) => void) {
    return this.emitter.once('close', cb);
  }

  createConnection() {
    return {
      onceClose: (cb: (code: number, reason: string) => void) => this.onceClose(cb),
      onMessage: (cb: (data: Uint8Array) => any) => this.onBinary(cb),
      send: (data: Uint8Array) => {
        this.sendBinary(data);
      },
      dispose() {},
    };
  }

  createSumiConnection(options: ISumiConnectionOptions = {}) {
    const conn = new SumiConnection(this.createConnection(), options);
    return conn;
  }

  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.sendQueue = [];
    this._disposables.dispose();
  }
}

interface IWSServerChannelCreateOptions extends IWSChannelCreateOptions {
  clientId: string;
}

/**
 * The server side channel, it will send a `server-ready` message after it receive a `open` message.
 */
export class WSServerChannel extends WSChannel {
  messageQueue: ChannelMessage[] = [];

  clientId: string;
  constructor(public connection: IConnectionShape<Uint8Array>, options: IWSServerChannelCreateOptions) {
    super(connection, options);
    this.clientId = options.clientId;
  }
  serverReady(token: string) {
    this.connection.send(
      stringify({
        kind: 'server-ready',
        id: this.id,
        token,
      }),
    );
  }

  dispatch(msg: ChannelMessage) {
    switch (msg.kind) {
      case 'data':
        this.emitter.emit('message', msg.content);
        break;
      case 'binary':
        this.emitter.emit('binary', msg.binary);
        break;
    }
  }
}

export type ChannelMessage =
  | PingMessage
  | PongMessage
  | OpenMessage
  | ServerReadyMessage
  | DataMessage
  | BinaryMessage
  | CloseMessage
  | ErrorMessage;

export const PingProtocol = Type.object('ping', {
  clientId: Type.string(),
  id: Type.string(),
});

export const PongProtocol = Type.object('pong', {
  clientId: Type.string(),
  id: Type.string(),
});

/**
 * `open` message is used to open a new channel.
 * `path` is used to identify which handler should be used to handle the channel.
 * `clientId` is used to identify the client.
 */
export interface OpenMessage {
  kind: 'open';
  id: string;
  path: string;
  clientId: string;
  connectionToken: string;
}

export const OpenProtocol = Type.object('open', {
  clientId: Type.string(),
  id: Type.string(),
  path: Type.string(),
  connectionToken: Type.string(),
});

/**
 * when server receive a `open` message, it should reply a `server-ready` message.
 * this is indicate that the channel is ready to use.
 */
export interface ServerReadyMessage {
  kind: 'server-ready';
  id: string;
  token: string;
}

export const ServerReadyProtocol = Type.object('server-ready', {
  id: Type.string(),
  token: Type.string(),
});

export enum ErrorMessageCode {
  ChannelNotFound = 1,
}

export interface ErrorMessage {
  kind: 'error';
  id: string;
  code: ErrorMessageCode;
  message: string;
}

export const ErrorProtocol = Type.object('error', {
  id: Type.string(),
  code: Type.uint16(),
  message: Type.string(),
});

export const DataProtocol = Type.object('data', {
  id: Type.string(),
  content: Type.string(),
});

export const BinaryProtocol = Type.object('binary', {
  id: Type.string(),
  binary: Type.binary(),
});

export const CloseProtocol = Type.object('close', {
  id: Type.string(),
  code: Type.uint32(),
  reason: Type.string(),
});

const serializer = oneOf([
  PingProtocol,
  PongProtocol,
  OpenProtocol,
  ServerReadyProtocol,
  DataProtocol,
  BinaryProtocol,
  CloseProtocol,
  ErrorProtocol,
]);

export function stringify(obj: ChannelMessage): Uint8Array {
  return serializer.serialize(obj);
}

export function parse(input: Uint8Array): ChannelMessage {
  return serializer.deserialize(input) as any;
}

const _pingMessage: PingMessage = {
  kind: 'ping',
  id: '',
  clientId: '',
};

const _pongMessage: PongMessage = {
  kind: 'pong',
  id: '',
  clientId: '',
};

export const pingMessage = stringify(_pingMessage);
export const pongMessage = stringify(_pongMessage);
