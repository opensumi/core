import { ChildConnectPath } from '../common/ws-channel';
import * as ws from 'ws';
import * as events from 'events';

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
  }
}

/**
 * 相当于 WebSocket
 */
class MultiConnect extends events.EventEmitter {

  public isConnected: boolean = false;

  get CONNECTING() {
    return MultiConnect.CONNECTING;
  }

  get CLOSING() {
    return MultiConnect.CLOSING;
  }

  get CLOSED() {
    return MultiConnect.CLOSED;
  }

  get OPEN() {
    return MultiConnect.OPEN;
  }

  get binaryType() {
    return this.connectionList[0].binaryType as BinaryType;
  }

  set binaryType(type) {
    this.connectionList.forEach((ws) => {
      ws.binaryType = type;
    });
  }

  get bufferedAmount() {
    let result = 0;

    this.connectionList.forEach((ws) => {
      result = result + ws.bufferedAmount;
    });

    return result;
  }

  public readyState: number = 0;

  private connectionList: ExtendWs[] = [];

  addConnection(cs: ws) {
    this.connectionList.push(cs);
    this.bindEvent(cs);
    if (cs.readyState === this.OPEN) {
      this.onOpen();
    }
  }

  ping(data?: any, mask?: boolean, cb?: (err: Error) => void) {
    this.connectionList.forEach((ws) => {
      ws.ping(data, mask, cb);
    });
  }

  close(code?: number, data?: string) {
    this.connectionList.forEach((ws) => {
      ws.close(code, data);
    });
  }

  async send(data: string, errorCallback: () => void) {
    // TODO 直接传标记，不要再解析一遍
    let content = JSON.parse(data).content || '{}';
    content = JSON.parse(content);
    const connection = this.getAvailableConnection( content.method ? content.method : '');

    if (!connection) {
      throw new Error('找不到可用连接！');
    }

    if (content.method) {
      connection.recentSendMessageMark = connection.recentSendMessageMark || new MessageMarkList();
      connection.recentSendMessageMark.push(content.method);
    }
    connection.sending = true;
    connection.send(data, (error) => {
      connection.sending = false;
      if (error && errorCallback) {
        errorCallback();
      }
    });
  }

  private getAvailableConnection(mark: string): ExtendWs | undefined {
    let oneAvailableConnection: ExtendWs | undefined;
    let availableConnection: ExtendWs | undefined;
    let recentSameMarkConnect;

    this.connectionList.filter((ws) => {
      // 过滤掉无效的连接
      if (this.isAvailable(ws)) {
        return true;
      }
      return false;
    }).forEach((ws, index) => {
      if (!oneAvailableConnection) {
        oneAvailableConnection = ws;
      }
      if (ws.readyState !== ws.OPEN) {
        return;
      }
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
    return recentSameMarkConnect || availableConnection || oneAvailableConnection;
  }

  private bindEvent(ws: ExtendWs) {
    ws.on('message', (data) => { this.emit('message', data); });
    ws.on('error', (error) => { this.emit('error', error); });
    ws.on('ping', (data) => { this.emit('ping', data); });
    ws.on('pong', (data) => { this.emit('pong', data); });
    ws.on('close', (code: number, message: string) => { this.onClose(code, message); });
  }

  private onClose(code: number, message: string ) {
    if (this.readyState === this.CLOSED) {
      return;
    }
    if (this.connectionList.some((ws: ExtendWs) => {
      if (ws.readyState === this.OPEN) {
        return true;
      }
      console.log('ws', ws.routeParam!);
      return false;
    })) {
      return;
    }
    this.emit('close', code, message);
    this.readyState = this.CLOSED;
  }

  private onOpen() {
    if (this.readyState === this.OPEN) {
      return;
    }
    this.emit('open');
    this.readyState = this.OPEN;
  }

  private isAvailable(ws) {
    return ws.OPEN === ws.readyState;
  }

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

/**
 * 相当于 ws.Server
 */
export class MultiWsServer extends events.EventEmitter {

  /**
   * 每个URL对应的 wsServer 的 map
   */
  private wsServerMap: Map<string, ws.Server> = new Map();

  /**
   * 每个窗口对应的 MultiConnect 的 map
   */
  private clientMap: Map<string, MultiConnect> = new Map();

  private onConnectionCallback: (args: any) => void;

  handleUpgrade(wsPathname: string, request: any, socket: any, head: any) {
    const clientId = request.headers['sec-websocket-protocol'];

    if (!clientId) {
      throw new Error('没有用 protocol 设置 clientId');
    }

    let wsServer = this.wsServerMap.get(wsPathname);

    if (!this.clientMap.get(clientId)) {
      this.clientMap.set(clientId, new MultiConnect());
    }
    const clientMultiConnect: MultiConnect = this.clientMap.get(clientId)!;

    if (!wsServer) {
      wsServer = new ws.Server({ noServer: true });
      wsServer.on('connection', (ws) => {
        const clientMultiConnect: MultiConnect = this.clientMap.get(ws.protocol)!;
        if (!clientMultiConnect.isConnected) {
          clientMultiConnect.isConnected = true;
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

  private onConnection = (connection: MultiConnect) => {
    this.emit('connection', connection);
  }
}
