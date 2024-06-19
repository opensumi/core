import { EventEmitter } from '@opensumi/events';
import { DisposableStore, EventQueue, randomString } from '@opensumi/ide-core-common';

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
  deliveryTimeout?: number;
}

enum MessageDeliveryState {
  ReSend,
  Sended,
  Success,
  Failed,
}

class StateTracer {
  private map = new Map<string, MessageDeliveryState>();

  protected deliveryTimeout = 500;
  protected timerMap = new Map<string, NodeJS.Timeout>();

  setDeliveryTimeout(timeout: number) {
    this.deliveryTimeout = timeout;
  }

  protected set(traceId: string, state: MessageDeliveryState) {
    this.map.set(traceId, state);
  }

  get(traceId: string) {
    return this.map.get(traceId);
  }

  success(traceId: string) {
    this.map.set(traceId, MessageDeliveryState.Success);
    const timer = this.timerMap.get(traceId);
    if (timer) {
      clearTimeout(timer);
    }
  }

  dispose() {
    this.timerMap.forEach((timer) => {
      clearTimeout(timer);
    });
  }

  stop(traceId: string) {
    const timer = this.timerMap.get(traceId);
    if (timer) {
      clearTimeout(timer);
    }
  }

  send(
    traceId: string,
    options: {
      whenRetry: () => void;
    },
  ) {
    this.set(traceId, MessageDeliveryState.Sended);
    this.guard(traceId, options);
  }

  guard(
    traceId: string,
    options: {
      whenRetry: () => void;
    },
  ) {
    const timer = this.timerMap.get(traceId);
    if (timer) {
      clearTimeout(timer);
    }

    const newTimer = setTimeout(() => {
      this.set(traceId, MessageDeliveryState.ReSend);
      options.whenRetry();
    }, this.deliveryTimeout);
    this.timerMap.set(traceId, newTimer);
  }
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

  protected stateTracer = new StateTracer();

  public id: string;

  public channelPath: string;
  public clientId: string;

  protected LOG_TAG = '[WSChannel]';

  logger: ILogger = console;

  constructor(public connection: IConnectionShape<ChannelMessage>, options: IWSChannelCreateOptions) {
    const { id, logger, ensureServerReady } = options;
    this.id = id;
    this.LOG_TAG = `[WSChannel id:${this.id}]`;
    if (logger) {
      this.logger = logger;
    }

    this._ensureServerReady = Boolean(ensureServerReady);
    if (options.deliveryTimeout) {
      this.stateTracer.setDeliveryTimeout(options.deliveryTimeout);
    }

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

  /**
   * @param traceId 一个 connection token 用于在全链路中追踪一个消息的生命周期，防止消息未发送或者重复发送
   */
  protected ensureMessageDeliveried(data: ChannelMessage, traceId = randomString(16)) {
    const state = this.stateTracer.get(traceId);
    if (state && state >= MessageDeliveryState.Sended) {
      this.logger.error(`message already send already success or in progress, traceId: ${traceId}, state: ${state}`);
      return;
    }

    data.traceId = traceId;
    this.connection.send(data);

    this.stateTracer.send(traceId, {
      whenRetry: () => {
        if (this._isServerReady) {
          this.stateTracer.stop(traceId);
          return;
        }
        this.ensureMessageDeliveried(data, traceId);
      },
    });
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
        if (msg.traceId) {
          this.stateTracer.success(msg.traceId);
        }

        this.resume();
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
              // 暂停消息发送, 直到收到 server-ready
              this.pause();
              this.open(this.channelPath, this.clientId);
            }
            break;
        }
        break;
    }
  }

  open(path: string, clientId: string) {
    this.channelPath = path;
    this.clientId = clientId;

    this.LOG_TAG = `[WSChannel id=${this.id} path=${path}]`;

    const msg = {
      kind: 'open',
      id: this.id,
      path,
      clientId,
    } as ChannelMessage;

    if (this._ensureServerReady) {
      this.ensureMessageDeliveried(msg);
    } else {
      this.connection.send(msg);
    }
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

  dispose() {
    this.stateTracer.dispose();
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

  serverReady(traceId: string) {
    this.connection.send({
      kind: 'server-ready',
      id: this.id,
      traceId,
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
