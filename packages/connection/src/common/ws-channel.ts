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
  public id: number|string;

  private connectionSend: (content: string) => void;
  private fireMessage: (data: any) => void;
  private fireOpen: (id: number) => void;
  private fireClose: (code: number, reason: string) => void;
  public messageConnection: any;

  constructor(connectionSend: (content: string) => void, id?: number|string) {
    this.connectionSend = connectionSend;
    if (id) {
      this.id = id;
    }
  }

  // server
  onMessage(cb: (data: any) => any) {
    this.fireMessage = cb;
  }
  onOpen(cb: (id: number) => void) {
    this.fireOpen = cb;
  }
  ready() {
    this.connectionSend(JSON.stringify({
      kind: 'ready',
      id: this.id,
    }));
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
    this.connectionSend(JSON.stringify({
      kind: 'open',
      id: this.id,
      path,
    }));
  }
  send(content: string) {
    this.connectionSend(JSON.stringify({
      kind: 'data',
      id: this.id,
      content,
    }));
  }
  onError() {}
  close(code: number, reason: string) {
    this.fireClose(code, reason);
  }
  onClose(cb: (code: number, reason: string) => void) {
    this.fireClose = cb ;
  }
}
