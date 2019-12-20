import * as shorid from 'shortid';
import { once, Emitter } from '@ali/ide-core-common';
import { MessageString, ChildConnectPath } from '../common/ws-channel';

let ReconnectingWebSocket = require('reconnecting-websocket');

if (ReconnectingWebSocket.default) {
  /* istanbul ignore next */
  ReconnectingWebSocket = ReconnectingWebSocket.default;
}

/**
 * 多通道websocket的实现，暴露同 Websocket 一致的属性、方法，内部由多条实际 websocket连接组成
 */
export class MultiWs implements WebSocket {

  public binaryType: BinaryType;

  public readonly bufferedAmount: number = 0;

  public readonly extensions: string = '';

  readonly protocol: string;

  public readyState: number = 0;

  readonly url: string;

  readonly CLOSED: number = 3;

  readonly CLOSING: number = 2;

  readonly CONNECTING: number = 0;

  readonly OPEN: number = 1;

  public clientId: string;

  public onmessage: (this: WebSocket, e: any) => any = () => {};

  public onclose: (this: WebSocket, e: any) => any = () => {};

  public onerror: (this: WebSocket, e: any) => any = () => {};

  public onopen: (this: WebSocket, e: any) => any = () => {};

  private connectionList: WebSocket[] = [];

  private defaultLength: number = 4;

  private listenerMap: {
    open: ((this: WebSocket, e: any) => any)[],
    close: ((this: WebSocket, e: any) => any)[],
  } = {
    open: [],
    close: [],
  };

  constructor(url: string, protocols?: string[], clientId?: string) {
    const connectPath = new ChildConnectPath();
    this.clientId = shorid.generate();
    this.protocol = (protocols || [''])[0];

    for (let i = 0; i < this.defaultLength; i++) {
      this.connectionList.push(new ReconnectingWebSocket(`${url}/${connectPath.getConnectPath(i, this.clientId)}`, [this.clientId], {}));
    }
    this.bindMethod();
  }

  /**
   * 目前前端消息发送不保证顺序
   * @param msg
   */
  async send(msg: MessageString) {
    const connection = this.getAvailableConnection();

    if (!connection) {
      throw new Error('找不到可用连接！');
    }

    connection.send(msg);
  }

  close(code?: number, reason?: string): void {
    this.connectionList.forEach((ws) => {
      ws.close(code, reason);
    });
    this.listenerMap = {close: [], open: []};
  }

  addEventListener(type, listener, options) {
    if (this.listenerMap[type]) {
      this.listenerMap[type].push(listener);
      return;
    }

    this.connectionList.forEach((ws) => {
      ws.addEventListener(type, listener, options);
    });
  }

  removeEventListener(type, listener, options) {
    if (this.listenerMap[type]) {
      this.listenerMap[type] = this.listenerMap[type].filter((l) => l !== listener);
      return;
    }

    this.connectionList.forEach((ws) => {
      ws.removeEventListener(type, listener, options);
    });
  }

  dispatchEvent(event) {
    return this.connectionList.every((ws) => {
      return ws.dispatchEvent(event);
    });
  }

  private bindMethod() {
    this.connectionList.forEach((connect) => {
      connect.onmessage = (event) => {
        this.onmessage(event);
      };
      connect.onerror = (event) => {
        this.onerror(event);
      };
      connect.onopen = (e) => {
        this.fireOnOpen(e);
      };
      connect.onclose = (e) => {
        this.fireOnClose(e);
      };
    });
  }

  private fireOnOpen(event) {
    if (this.readyState === this.OPEN) {
      return;
    }
    this.readyState = this.OPEN;
    this.onopen.call(this, event);
    this.listenerMap.open.forEach((listener) => {
      listener.call(this, event);
    });
  }

  private fireOnClose(event) {
    if (this.connectionList.some((ws) => {
      return ws.readyState === this.OPEN;
    })) {
      return;
    }
    this.readyState = this.CLOSED;
    this.onclose.call(this, event);
    this.listenerMap.close.forEach((listener) => {
      listener.call(this, event);
    });
  }

  private getAvailableConnection(): WebSocket | undefined {
    let oneAvailableConnection: WebSocket | undefined;

    this.connectionList.filter((ws) => {
      if (this.isAvailable(ws)) {
        return true;
      }
      return false;
    }).some((ws) => {
      if (!oneAvailableConnection) {
        oneAvailableConnection = ws;
      }
      if (ws.bufferedAmount === 0) {
        oneAvailableConnection = ws;
        return true;
      }
      return false;
    });

    return oneAvailableConnection;
  }

  private isAvailable(ws) {
    return ws.OPEN === ws.readyState;
  }
}
