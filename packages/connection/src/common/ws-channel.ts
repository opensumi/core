import { EventEmitter } from '@opensumi/events';
import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { BinaryConnection } from './binary-rpc/connection';
import { stringify } from './utils';

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

export type ConnectionSend = (content: PlatformBuffer | string) => void;

type IWSChannelEventType = 'message' | 'binary' | 'open' | 'reOpen' | 'close' | 'error';

export class WSChannel implements IWebSocket {
  private emitter = new EventEmitter<IWSChannelEventType>();

  public id: string;
  public channelPath: string;

  private connectionSend: ConnectionSend;

  constructor(connectionSend: ConnectionSend, id?: string) {
    this.connectionSend = connectionSend;
    if (id) {
      this.id = id;
    }
  }

  public setConnectionSend(connectionSend: ConnectionSend) {
    this.connectionSend = connectionSend;
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
    this.connectionSend(
      stringify({
        kind: 'ready',
        id: this.id,
      }),
    );
  }

  handleMessage(msg: ChannelMessage) {
    if (msg.kind === 'ready') {
      this.emitter.emit('open', msg.id);
    } else if (msg.kind === 'data') {
      this.emitter.emit('message', msg.content);
    } else if (msg.kind === 'binary') {
      this.emitter.emit('binary', msg.binary);
    }
  }

  // client
  open(path: string) {
    this.channelPath = path;
    this.connectionSend(
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

    this.connectionSend(
      stringify({
        kind: 'data',
        id: this.id,
        content,
      }),
    );
  }

  sendBinary(binary: PlatformBuffer) {
    this.connectionSend(
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
    const binaryConnection = new BinaryConnection({
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
    return binaryConnection;
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
