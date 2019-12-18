import * as shorid from 'shortid';
import { once } from '@ali/ide-core-common';
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

  private onOpenlistener: (this: WebSocket, e: any) => any = () => {};

  private onCloselistener: (this: WebSocket, e: any) => any = () => {};

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

    if (connection.readyState !== connection.OPEN) {
      throw new Error('找不到可用连接！');
    }

    connection.send(msg);
  }

  close(code?: number, reason?: string): void {
    this.connectionList.forEach((ws) => {
      ws.close(code, reason);
    });
  }

  addEventListener(type, listener, options) {
    if (type === 'open') {
      this.onOpenlistener = listener;
      return;
    }
    if (type === 'close') {
      this.onCloselistener = listener;
      return;
    }
    this.connectionList.forEach((ws) => {
      ws.addEventListener(type, listener, options);
    });
  }

  removeEventListener(type, listener, options) {
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

  private fireOnOpen = once((event) => {
    this.readyState = this.OPEN;
    this.onOpenlistener(event);
    this.onopen.call(this, event);
  });

  private fireOnClose(event) {
    if (this.connectionList.some((ws) => {
      return ws.readyState === this.OPEN;
    })) {
      return;
    }
    this.readyState = this.CLOSED;
    this.onclose.call(this, event);
    this.onCloselistener(event);
  }

  private getAvailableConnection() {
    let connection = this.connectionList[0];

    this.connectionList.filter((ws) => {
      if (ws.OPEN === ws.readyState) {
        return true;
      }
      return false;
    }).some((ws) => {
      if (ws.bufferedAmount === 0) {
        connection = ws;
        return true;
      }
      return false;
    });

    return connection;
  }
}
