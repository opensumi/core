let ReconnectingWebSocket = require('reconnecting-websocket');

if (ReconnectingWebSocket.default) {
  /* istanbul ignore next */
  ReconnectingWebSocket = ReconnectingWebSocket.default;
}

export class MultiWs {

  public onmessage: (e: any) => {};

  private connectionList: WebSocket[] = [];

  private defaultLength: number = 4;

  constructor(url: string, protocols?: string[]) {
    for (let i = 0; i < this.defaultLength; i++) {
      // TODO 建立失败
      this.connectionList.push(new ReconnectingWebSocket(`${url}/${i + 1}`, protocols, {}));
    }
    this.initOnMessage();
  }

  async send(msg: string) {
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
