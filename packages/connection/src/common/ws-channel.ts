import type net from 'net';

import Fury, { Type } from '@furyjs/fury';
import type WebSocket from 'ws';

import { EventEmitter } from '@opensumi/events';
import { DisposableCollection } from '@opensumi/ide-core-common';

import { Connection } from '../common/rpc/connection';

import { NetSocketConnection, WSWebSocketConnection } from './connection';
import { IConnectionShape } from './connection/types';
import { createWebSocketConnection } from './message';
import { ILogger } from './types';

export interface IWebSocket {
  send(content: string): void;
  close(...args: any[]): void;
  onMessage(cb: (data: any) => void): void;
  onError(cb: (reason: any) => void): void;
  onClose(cb: (code: number, reason: string) => void): void;
}

export interface PingMessage {
  kind: 'ping';
  clientId: string;
  id: string;
}

export interface PongMessage {
  kind: 'pong';
  clientId: string;
  id: string;
}

export interface OpenMessage {
  kind: 'open';
  id: string;
  path: string;
  clientId: string;
}
export interface ServerReadyMessage {
  kind: 'server-ready';
  id: string;
}
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
export type ChannelMessage =
  | PingMessage
  | PongMessage
  | OpenMessage
  | ServerReadyMessage
  | DataMessage
  | BinaryMessage
  | CloseMessage;

export interface IWSChannelCreateOptions {
  /**
   * every channel's unique id
   */
  id: string;
  /**
   * @example browser | ws-server | net-server | net-client | port1 | port2
   */
  tag: string;
  logger?: ILogger;
}

export class WSChannel implements IWebSocket {
  protected emitter = new EventEmitter<{
    message: [data: string];
    open: [id: string];
    reopen: [];
    close: [code?: number, reason?: string];
    binary: [buffer: Uint8Array];
  }>();

  public id: string;
  /**
   * Because this class will be used in both browser and nodejs/electron, so we should use tag to distinguish each other.
   */
  public tag: string;
  public channelPath: string;

  logger: ILogger = console;

  static forClient(connection: IConnectionShape<Uint8Array>, options: IWSChannelCreateOptions) {
    const disposable = new DisposableCollection();
    const channel = new WSChannel(connection, options);

    disposable.push(
      connection.onMessage((data) => {
        channel.handleMessage(parse(data));
      }),
    );
    disposable.push(channel);

    disposable.push(
      connection.onceClose(() => {
        disposable.dispose();
      }),
    );

    return channel;
  }

  static forWebSocket(socket: WebSocket, options: IWSChannelCreateOptions) {
    const wsConnection = new WSWebSocketConnection(socket);
    return WSChannel.forClient(wsConnection, options);
  }

  static forNetSocket(socket: net.Socket, options: IWSChannelCreateOptions) {
    const wsConnection = new NetSocketConnection(socket);
    return WSChannel.forClient(wsConnection, options);
  }

  LOG_TAG = '[WSChannel]';

  constructor(public connection: IConnectionShape<Uint8Array>, options: IWSChannelCreateOptions) {
    const { id, logger, tag } = options;
    this.id = id;
    this.tag = tag;

    if (logger) {
      this.logger = logger;
    }

    this.LOG_TAG = `[WSChannel] [tag:${this.tag}] [id:${this.id}]`;
  }

  // server
  onMessage(cb: (data: string) => any) {
    return this.emitter.on('message', cb);
  }
  onOpen(cb: (id: string) => void) {
    return this.emitter.on('open', cb);
  }
  onReopen(cb: () => void) {
    return this.emitter.on('reopen', cb);
  }
  serverReady() {
    this.connection.send(
      stringify({
        kind: 'server-ready',
        id: this.id,
      }),
    );
  }

  handleMessage(msg: ChannelMessage) {
    if (msg.kind === 'server-ready') {
      this.emitter.emit('open', msg.id);
    } else if (msg.kind === 'data') {
      this.emitter.emit('message', msg.content);
    } else if (msg.kind === 'binary') {
      this.emitter.emit('binary', msg.binary);
    }
  }

  // client
  open(path: string, clientId: string) {
    this.channelPath = path;
    this.connection.send(
      stringify({
        kind: 'open',
        id: this.id,
        path,
        clientId,
      }),
    );
  }
  send(content: string) {
    this.connection.send(
      stringify({
        kind: 'data',
        id: this.id,
        content,
      }),
    );
  }

  sendBinary(binary: Uint8Array) {
    this.connection.send(
      stringify({
        id: this.id,
        kind: 'binary',
        binary,
      }),
    );
  }

  onBinary(cb: (binary: Uint8Array) => void) {
    return this.emitter.on('binary', cb);
  }

  hasMessageListener() {
    return this.emitter.hasListener('message');
  }
  onError() {}
  close(code?: number, reason?: string) {
    this.emitter.emit('close', code, reason);
  }
  fireReopen() {
    this.emitter.emit('reopen');
  }
  onClose(cb: (code: number, reason: string) => void) {
    return this.emitter.on('close', cb);
  }
  createMessageConnection() {
    return createWebSocketConnection(this);
  }
  createConnection() {
    return new Connection({
      onMessage: (cb) => {
        const remove = this.onBinary(cb);
        return {
          dispose: () => {
            remove();
          },
        };
      },
      send: (data) => {
        this.sendBinary(data);
      },
      onceClose(cb) {
        return this.onceClose(cb);
      },
    });
  }
  dispose() {
    this.emitter.dispose();
  }

  listen(channel: WSChannel) {
    channel.onMessage((data) => {
      this.send(data);
    });
    channel.onClose((code, reason) => {
      this.close(code, reason);
    });
    channel.onReopen(() => {
      this.fireReopen();
    });
  }
}

export type MessageString = string & {
  origin?: any;
};

/**
 * 路径信息 ${pre}-${index}
 */
export class ChildConnectPath {
  public pathPre = 'child_connect-';

  getConnectPath(index: number, clientId: string) {
    return `${this.pathPre}${index + 1}`;
  }

  parseInfo(pathString: string) {
    const list = pathString.split('-');

    return {
      pre: list[0],
      index: list[1],
      clientId: list[2],
    };
  }
}

const fury = new Fury({});

export const wsChannelProtocol = Type.object('ws-channel-protocol', {
  kind: Type.string(),
  clientId: Type.string(),
  id: Type.string(),
  path: Type.string(),
  content: Type.string(),
  code: Type.uint32(),
  reason: Type.string(),
  binary: Type.binary(),
});

const wsChannelProtocolSerializer = fury.registerSerializer(wsChannelProtocol);

export function stringify(obj: ChannelMessage): Uint8Array {
  return wsChannelProtocolSerializer.serialize(obj);
}

export function parse(input: Uint8Array): ChannelMessage {
  return wsChannelProtocolSerializer.deserialize(input) as any;
}
