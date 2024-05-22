import { EventEmitter } from '@opensumi/events';
import {
  DisposableCollection,
  DisposableStore,
  EventQueue,
  StateTracer,
  randomString,
} from '@opensumi/ide-core-common';

import { ChannelMessage, ErrorMessageCode } from './channel/types';
import { IConnectionShape } from './connection/types';
import { ISumiConnectionOptions, SumiConnection } from './rpc/connection';
import { ILogger } from './types';

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

  protected sendQueue: ChannelMessage[] = [];
  protected _isServerReady = false;
  protected _ensureServerReady: boolean | undefined;

  public id: string;

  public channelPath: string;
  public clientId: string;

  protected LOG_TAG = '[WSChannel]';

  logger: ILogger = console;

  static forClient(connection: IConnectionShape<ChannelMessage>, options: IWSChannelCreateOptions) {
    const disposable = new DisposableCollection();
    const channel = new WSChannel(connection, options);
    disposable.push(channel.listen());

    connection.onceClose(() => {
      disposable.dispose();
    });

    return channel;
  }

  constructor(public connection: IConnectionShape<ChannelMessage>, options: IWSChannelCreateOptions) {
    const { id, logger, ensureServerReady } = options;
    this.id = id;
    this.LOG_TAG = `[WSChannel id=${this.id}]`;
    if (logger) {
      this.logger = logger;
    }

    this._ensureServerReady = Boolean(ensureServerReady);

    this._disposables.add(this.emitter.on('binary', (data) => this.onBinaryQueue.push(data)));
  }

  protected inqueue(data: ChannelMessage) {
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
      case 'error':
        this.logger.error(this.LOG_TAG, `receive error: id: ${msg.id}, code: ${msg.code}, error: ${msg.message}`);
        switch (msg.code) {
          case ErrorMessageCode.ChannelNotFound:
            // 有 channelPath 说明该 channel 曾经被打开过
            // 重新打开 channel
            if (this.channelPath) {
              // 暂停消息发送直到 server-ready
              this.pause();
              this.open(this.channelPath, this.clientId);
            }
            break;
        }
        break;
    }
  }

  stateTracer = this._disposables.add(new StateTracer());

  /**
   * @param connectionToken 一个 connection token 用于在全链路中追踪一个 channel 的生命周期，防止 channel 被重复打开
   */
  open(path: string, clientId: string, connectionToken = randomString(16)) {
    this.channelPath = path;
    this.clientId = clientId;

    this.LOG_TAG = `[WSChannel id=${this.id} path=${path}]`;

    if (this.stateTracer.has(connectionToken)) {
      this.logger.warn(
        `channel already opened or in progress, path: ${path}, clientId: ${clientId}, connectionToken: ${connectionToken}`,
      );
      return;
    }

    this.stateTracer.record(connectionToken);

    this.connection.send({
      kind: 'open',
      id: this.id,
      path,
      clientId,
      connectionToken,
    });

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
    this.inqueue({
      kind: 'data',
      id: this.id,
      content,
    });
  }

  sendBinary(data: Uint8Array) {
    this.inqueue({
      kind: 'binary',
      id: this.id,
      binary: data,
    });
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

  listen() {
    return this.connection.onMessage((data) => {
      this.dispatch(data);
    });
  }

  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.sendQueue = [];
    this._disposables.dispose();
  }

  ping() {
    this.connection.send({
      kind: 'ping',
      id: this.id,
    });
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
  constructor(public connection: IConnectionShape<ChannelMessage>, options: IWSServerChannelCreateOptions) {
    super(connection, options);
    this.clientId = options.clientId;
  }
  serverReady(token: string) {
    this.connection.send({
      kind: 'server-ready',
      id: this.id,
      token,
    });
  }

  dispatch(msg: ChannelMessage) {
    switch (msg.kind) {
      case 'data':
        this.emitter.emit('message', msg.content);
        break;
      case 'binary':
        this.emitter.emit('binary', msg.binary);
        break;
      case 'ping':
        this.connection.send({
          kind: 'pong',
          id: this.id,
        });
        break;
    }
  }
}
