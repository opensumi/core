import Fury, { Type } from '@furyjs/fury';

import { EventEmitter } from '@opensumi/events';
import { Deferred, ILogger } from '@opensumi/ide-core-common';
import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { BinaryConnection } from './sumi-rpc/connection';

import { createWebSocketConnection } from '.';

export interface IWebSocket {
  // send(content: PlatformBuffer, isBinary: true): void;
  send(content: string): void;
  close(...args): void;
  onMessage(cb: (data: any) => void): void;
  onError(cb: (reason: any) => void): void;
  onClose(cb: (code: number, reason: string) => void): void;
}

export interface ClientMessage {
  kind: 'client';
  clientId: string;
}
export interface HeartbeatMessage {
  kind: 'heartbeat';
  clientId: string;
}
export interface OpenMessage {
  kind: 'open';
  id: string;
  path: string;
}
export interface ReadyMessage {
  kind: 'ready';
  id: string;
}
export interface DataMessage {
  kind: 'data';
  id: string;
  content: string;
}
export interface CloseMessage {
  kind: 'close';
  id: string;
  code: number;
  reason: string;
}

export interface BinaryMessage {
  kind: 'binary';
  id: string;
  binary: PlatformBuffer;
}

export type ChannelMessage =
  | HeartbeatMessage
  | ClientMessage
  | OpenMessage
  | ReadyMessage
  | DataMessage
  | CloseMessage
  | BinaryMessage;

export type TConnectionSend = (content: PlatformBuffer | string) => void;

type TEventType = 'message' | 'binary' | 'open' | 'reOpen' | 'close' | 'error';

export class SocketChannel implements IWebSocket {
  private isReadyPromise = new Deferred<void>();
  private emitter = new EventEmitter<TEventType>();

  public id: string;
  public channelPath: string;

  private _rawSend: TConnectionSend;

  logger: ILogger;

  constructor(connectionSend: TConnectionSend, options?: { id?: string; logger?: ILogger }) {
    this._rawSend = connectionSend;
    if (options?.logger) {
      this.logger = options.logger;
    }
    if (options?.id) {
      this.id = options?.id;
    }
  }

  public setConnectionSend(connectionSend: TConnectionSend) {
    this._rawSend = connectionSend;
  }

  onMessage(cb: (data: any) => any) {
    return this.emitter.on('message', cb);
  }
  onBinary(cb: (data: PlatformBuffer) => any) {
    return this.emitter.on('binary', cb);
  }
  onOpen(cb: (id: string) => void) {
    return this.emitter.on('open', cb);
  }
  onReOpen(cb: () => void) {
    return this.emitter.on('reOpen', cb);
  }
  onClose(cb: (code: number, reason: string) => void) {
    return this.emitter.on('close', cb);
  }
  onError(cb: (err: any) => void) {
    return this.emitter.on('error', cb);
  }

  fireReOpen() {
    this.emitter.emit('reOpen');
  }

  ready() {
    this._rawSend(
      stringify({
        kind: 'ready',
        id: this.id,
      }),
    );
  }

  whenReady() {
    return this.isReadyPromise.promise;
  }

  isReady = false;
  handleMessage(msg: ChannelMessage) {
    if (msg.kind === 'ready') {
      this.isReady = true;
      this.isReadyPromise.resolve();
      this.emitter.emit('open', msg.id);
    } else if (msg.kind === 'data') {
      this.emitter.emit('message', msg.content);
    } else if (msg.kind === 'binary') {
      this.emitter.emit('binary', msg.binary);
    }
  }

  open(path: string) {
    this.channelPath = path;
    this._rawSend(
      stringify({
        kind: 'open',
        id: this.id,
        path,
      }),
    );
  }

  send(content: PlatformBuffer, isBinary: true): void;
  send(content: string): void;
  send(content: any, isBinary?: boolean) {
    if (isBinary) {
      this.sendBinary(content as any);
      return;
    }

    this._rawSend(
      stringify({
        kind: 'data',
        id: this.id,
        content,
      }),
    );
  }

  sendBinary(binary: PlatformBuffer) {
    this._rawSend(
      stringify({
        kind: 'binary',
        id: this.id,
        binary,
      }),
    );
  }

  close(code: number, reason: string) {
    this.emitter.emit('close', code, reason);
  }

  createMessageConnection() {
    return createWebSocketConnection(this);
  }

  createBinaryConnection() {
    return new BinaryConnection({
      onmessage: (cb) => {
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
    });
  }

  listenChannel(channel: SocketChannel) {
    let toDispose = [] as (() => void)[];
    toDispose.push(
      channel.onMessage((data) => {
        this.send(data);
      }),
    );
    toDispose.push(
      channel.onBinary((data) => {
        this.sendBinary(data);
      }),
    );

    return {
      dispose: () => {
        toDispose.forEach((dispose) => dispose());
        toDispose = [];
      },
    };
  }

  dispose() {
    this.emitter.dispose();
  }
}

export type SocketMessage = PlatformBuffer & {
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

/**
 * @furyjs/hps use v8's fast-calls-api that can be called directly by jit, ensure that the version of Node is 20 or above.
 * Experimental feature, installation success cannot be guaranteed at this moment
 **/
// import hps from '@furyjs/hps';

const hps = undefined;

const fury = new Fury({ hps });

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

export function stringify(obj: ChannelMessage): PlatformBuffer {
  return wsChannelProtocolSerializer.serialize(obj);
}

export function parse(input: PlatformBuffer): any {
  return wsChannelProtocolSerializer.deserialize(input);
}
