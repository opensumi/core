import * as shorid from 'shortid';
import { MessageString, ChildConnectPath } from '../common/ws-channel';

let ReconnectingWebSocket = require('reconnecting-websocket');

if (ReconnectingWebSocket.default) {
  /* istanbul ignore next */
  ReconnectingWebSocket = ReconnectingWebSocket.default;
}

/**
 * 多通道websocket的实现，暴露同 Websocket 一致的属性、方法，内部由多条实际 websocket连接组成
 */
export class MultiWs {

  public clientId: string;

  public onmessage: (e: any) => {};

  private connectionList: WebSocket[] = [];

  private defaultLength: number = 4;

  constructor(url: string, protocols?: string[], clientId?: string) {
    const connectPath = new ChildConnectPath();
    this.clientId = shorid.generate();

    for (let i = 0; i < this.defaultLength; i++) {
      // TODO 建立失败
      this.connectionList.push(new ReconnectingWebSocket(`${url}/${connectPath.getConnectPath(i, this.clientId)}`, [this.clientId], {}));
    }
    this.initOnMessage();
  }

  /**
   * 目前前端消息发送不保证顺序
   * @param msg
   */
  async send(msg: MessageString) {
    this.getAvailableConnection().send(msg);
  }

  addEventListener(name: string, callback: () => {}) {
    // TODO dispose
    this.connectionList[0].addEventListener(name, callback);
  }

  private initOnMessage() {
    this.connectionList.forEach((connect) => {
      connect.onmessage = (e) => {
        this.onmessage(e);
      };
    });
  }

  private getAvailableConnection() {
    // TODO 已经清理已经销毁的
    let connection = this.connectionList[0];

    this.connectionList.some((ws) => {
      if (ws.bufferedAmount === 0) {
        connection = ws;
        return true;
      }
      return false;
    });

    return connection;
  }
}
