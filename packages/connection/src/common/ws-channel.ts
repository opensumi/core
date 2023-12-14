import { EventEmitter } from '@opensumi/events';

import { ILogger } from './types';
import { stringify } from './utils';

export interface IWebSocket {
  send(content: string): void;
  close(...args): void;
  onMessage(cb: (data: any) => void): void;
  onError(cb: (reason: any) => void): void;
  onClose(cb: (code: number, reason: string) => void): void;
}

export interface ClientMessage {
  kind: 'client';
  id: string;
}
export interface HeartbeatMessage {
  kind: 'heartbeat';
  id: string;
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
export type ChannelMessage = HeartbeatMessage | ClientMessage | OpenMessage | ReadyMessage | DataMessage | CloseMessage;

export class WSChannel implements IWebSocket {
  protected emitter = new EventEmitter<{
    message: [data: any];
    open: [id: string];
    reOpen: [];
    close: [code: number, reason: string];
  }>();

  public id: string;
  /**
   * Because this class will be used in both browser and nodejs/electron, so we should use tag to distinguish each other.
   */
  public tag: string;
  public channelPath: string;

  logger: ILogger = console;

  private connectionSend: (content: string) => void;

  public messageConnection: any;

  get LOG_TAG() {
    return [
      '[WSChannel]',
      this.tag ? `[tag:${this.tag}]` : '',
      this.id ? `[id:${this.id}]` : '',
      this.channelPath ? `[channel-path:${this.channelPath}]` : '',
    ].join(' ');
  }

  constructor(connectionSend: (content: string) => void, options: { id: string; logger?: ILogger; tag: string }) {
    this.connectionSend = connectionSend;

    const { id, logger, tag } = options;
    this.id = id;
    this.tag = tag;

    if (logger) {
      this.logger = logger;
    }
  }

  public setConnectionSend(connectionSend: (content: string) => void) {
    this.connectionSend = connectionSend;
  }

  // server
  onMessage(cb: (data: any) => any) {
    this.emitter.on('message', cb);
  }
  onOpen(cb: (id: string) => void) {
    this.emitter.on('open', cb);
  }
  onReOpen(cb: () => void) {
    this.emitter.on('reOpen', cb);
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
    );
  }
  hasMessageListener() {
    return this.emitter.hasListener('message');
  }
  onError() {}
  close(code: number, reason: string) {
    this.emitter.emit('close', code, reason);
  }
  fireReOpen() {
    this.emitter.emit('reOpen');
  }
  onClose(cb: (code: number, reason: string) => void) {
    this.emitter.on('close', cb);
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
