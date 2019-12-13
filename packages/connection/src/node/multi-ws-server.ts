import { ChildConnectPath } from '../common/ws-channel';
import * as once from 'lodash.once';
import * as ws from 'ws';

interface ExtendWs extends ws {
  sending?: boolean;
  recentSendMessageMark?: MessageMarkList;
  routeParam?: {
    pathname: string,
  };

}

interface MessageMarkInfo {
  lastUseDate: number;
  usedTimes: number;
}

const childConnectPath = new ChildConnectPath();

class MessageMarkList {
  public maxLength: number;
  public listMap: Map<any, MessageMarkInfo> = new Map();

  constructor(length?: number) {
    this.maxLength = length || 3;
  }

  push(key: any) {
    const item: MessageMarkInfo = this.listMap.get(key) || { lastUseDate: 0 , usedTimes: 0};

    item.lastUseDate = new Date().getTime();
    item.usedTimes = item.usedTimes + 1;

    this.listMap.set(key, item);
    this.clearInvalid();
  }

  has(key: any) {
    this.clearInvalid();
    return !!this.listMap.get(key);
  }

  clear() {
    this.listMap.clear();
  }

  clearInvalid() {
    let lastInsertItem;
    let lastInsertKey;
    const willClearKeyList: any[] = [];

    this.listMap.forEach((value, key) => {
      lastInsertItem = lastInsertItem || value;
      lastInsertKey = lastInsertKey || key;

      if (value.lastUseDate > lastInsertItem) {
        lastInsertItem = value;
        lastInsertKey = key;
      }

      if (new Date().getTime() - value.lastUseDate > 100) {
        // 100ms内没有被触发过的清除
        willClearKeyList.push(key);
      }
    });

    if (this.listMap.size > this.maxLength) {
      willClearKeyList.push(lastInsertKey);
    }

    willClearKeyList.forEach((key) => {
      this.listMap.delete(key);
    });

    console.log('this.listMap.size', this.listMap.size);
  }
}

class MultiConnect {

  public CONNECTING: 0 = 0;
  public OPEN: 1 = 1;
  public CLOSING: 2 = 2;
  public CLOSED: 3 = 3;

  public readyState: number = 0;

  private onMessageCallback: (args: any) => void = () => {};

  private onCloseCallback: (args: any) => void = () => {};

  private connectionList: ExtendWs[] = [];

  constructor() {}

  addConnection(cs: ws) {
    this.connectionList.push(cs);
    // TODO dispose
    cs.on('message', this.onMessageCallback);
  }

  on(name: string, callback: (args: any) => void) {
    if (name === 'message') {
      this.onMessageCallback = callback;
    }
    if (name === 'close') {
      this.onCloseCallback = callback;
    }
  }

  ping() {
    // TODO
  }

  async send(data: string, errorCallback: () => void) {
    // TODO 直接传标记，不要再解析一遍
    let content = JSON.parse(data).content || '{}';
    content = JSON.parse(content);
    const connection = this.getAvailableConnection( content.method ? content.method : '');

    if (content.method) {
      connection.recentSendMessageMark = connection.recentSendMessageMark || new MessageMarkList();
      connection.recentSendMessageMark.push(content.method);
    }
    // console.log('send start', (connection as any).routeParam);
    connection.sending = true;
    connection.send(data, (error) => {
      // console.log('send end', (connection as any).routeParam);
      connection.sending = false;
      errorCallback();
    });
  }

  private getAvailableConnection(mark: string): ExtendWs {
    // TODO 已经清理已经销毁的
    const lastConnection = this.connectionList[this.connectionList.length - 1];
    let availableConnection;
    let recentSameMarkConnect;

    this.connectionList.forEach((ws, index) => {
      if (!ws.sending && !availableConnection) {
        console.log('找到可用连接', ws.routeParam);
        availableConnection = ws;
      }
      if (mark && ws.recentSendMessageMark && ws.recentSendMessageMark.has(mark)) {
        console.log('找到之前使用过的连接', ws.routeParam, mark);
        // 返回最近同类型消息使用过的通道，来保证消息的顺序
        recentSameMarkConnect = ws;
      }
    });
    return recentSameMarkConnect || availableConnection || lastConnection;
  }

}

export class MultiWsServer {

  /**
   * 每个URL对应的 wsServer 的 map
   */
  private wsServerMap: Map<string, ws.Server> = new Map();

  /**
   * 每个窗口对应的 MultiConnect 的 map
   */
  private clientMap: Map<string, MultiConnect> = new Map();

  private onConnectionCallback: (args: any) => void;

  constructor() {
  }

  handleUpgrade(wsPathname: string, request: any, socket: any, head: any) {
    const clientId = request.headers['sec-websocket-protocol'];

    if (!clientId) {
      throw new Error('没有用 protocol 设置 clientId');
    }

    let wsServer = this.wsServerMap.get(wsPathname);

    if (!this.clientMap.get(clientId)) {
      console.log('create new MultiConnect', clientId);
      this.clientMap.set(clientId, new MultiConnect());
    }
    const clientMultiConnect: MultiConnect = this.clientMap.get(clientId)!;

    if (!wsServer) {
      wsServer = new ws.Server({ noServer: true });
      wsServer.on('connection', (ws) => {
        const clientMultiConnect: MultiConnect = this.clientMap.get(ws.protocol)!;
        if (clientMultiConnect.readyState !== 1) {
          clientMultiConnect.readyState = 1;
          this.onConnection(clientMultiConnect);
        }
      });
    }

    wsServer.handleUpgrade(request, socket, head, (connection: ws) => {
      (connection as any).routeParam = {
        pathname: wsPathname,
      };
      wsServer!.emit('connection', connection);
      clientMultiConnect.addConnection(connection);
    });
    this.wsServerMap.set(wsPathname, wsServer);
  }

  on(name: string, callback: (args: any) => void) {
    if (name === 'connection') {
      this.onConnectionCallback = callback;
    }
  }

  emit() {
    // TODO
  }

  private onConnection = (connection: MultiConnect) => {
    console.log('connection1');
    this.onConnectionCallback(connection);
  }
}
