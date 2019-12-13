import * as ws from 'ws';
import { stringify } from './utils';
import { IDisposable } from '@ali/ide-core-common';

export interface IWebSocket {
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
  id: number;
  path: string;
}
export interface ReadyMessage {
  kind: 'ready';
  id: number;
}
export interface DataMessage {
  kind: 'data';
  id: number;
  content: string;
}
export interface CloseMessage {
  kind: 'close';
  id: number;
  code: number;
  reason: string;
}
export type ChannelMessage = HeartbeatMessage | ClientMessage | OpenMessage | ReadyMessage | DataMessage | CloseMessage;

export class WSChannel implements IWebSocket {
  public id: number | string;
  public channelPath: string;

  private connectionSend: (content: string, original?: any) => void;
  private connection: ws;
  private fireMessage: (data: any) => void;
  private fireOpen: (id: number) => void;
  public fireReOpen: () => void;
  private fireClose: (code: number, reason: string) => void;

  public messageConnection: any;

  constructor(connectionSend: (content: string) => void, id?: number | string) {
    this.connectionSend = connectionSend;
    if (id) {
      this.id = id;
    }
  }

  public setConnectionSend(connectionSend: (content: string, original?: any) => void) {
    this.connectionSend = connectionSend;
  }

  // server
  onMessage(cb: (data: any) => any) {
    this.fireMessage = cb;
  }
  onOpen(cb: (id: number) => void) {
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
    if (msg.kind === 'ready') {
      this.fireOpen(msg.id);
    } else if (msg.kind === 'data') {
      this.fireMessage(msg.content);
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
  send(content: string) {
    this.connectionSend(
      stringify({
        kind: 'data',
        id: this.id,
        content,
      }),
      content,
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
