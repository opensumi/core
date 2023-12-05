import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { BinaryConnection } from './binary-connection';
import { stringify } from './utils';

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

export class WSChannel implements IWebSocket {
  public id: string;
  public channelPath: string;

  private connectionSend: ConnectionSend;
  private fireMessage: (data: any) => void;
  private fireBinary: (data: PlatformBuffer) => void;
  private fireOpen: (id: string) => void;
  public fireReOpen: () => void;
  private fireClose: (code: number, reason: string) => void;

  constructor(connectionSend: ConnectionSend, id?: string) {
    this.connectionSend = connectionSend;
    if (id) {
      this.id = id;
    }
  }

  public setConnectionSend(connectionSend: ConnectionSend) {
    this.connectionSend = connectionSend;
  }

  // server
  onMessage(cb: (data: any) => any) {
    this.fireMessage = cb;
  }
  onBinary(cb: (data: PlatformBuffer) => any) {
    this.fireBinary = cb;
  }
  onOpen(cb: (id: string) => void) {
    this.fireOpen = cb;
  }
  onReOpen(cb: () => void) {
    this.fireReOpen = cb;
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
    if (msg.kind === 'ready' && this.fireOpen) {
      this.fireOpen(msg.id);
    } else if (msg.kind === 'data' && this.fireMessage) {
      this.fireMessage(msg.content);
    } else if (msg.kind === 'binary' && this.fireBinary) {
      this.fireBinary(msg.binary);
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

  onError() {}

  close(code: number, reason: string) {
    if (this.fireClose) {
      this.fireClose(code, reason);
    }
  }

  onClose(cb: (code: number, reason: string) => void) {
    this.fireClose = cb;
  }

  createBinaryConnection() {
    const binaryConnection = new BinaryConnection({
      onmessage: (cb) => this.onBinary(cb),
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
