import {RPCProxy} from '../common/proxy';
import {createMessageConnection, WebSocketMessageReader, WebSocketMessageWriter} from '@ali/vscode-jsonrpc';
import {WebSocketChannel} from '../common/websocket-channel';
import {RPCService} from '../common/proxy';

// interface IRPCProxyTarget {
// }

export class StubClient {
  private stubClientServiceMap: Map<string, RPCService> = new Map();
  private stubServiceProxyMap: Map<string, Promise<RPCProxy>> = new Map();
  private channelMap: Map<number, WebSocketChannel> = new Map();
  private stubConnection: WebSocket;
  private channelId = 0;

  constructor(connection: any, private logger: any = console) {
    this.stubConnection = connection;
    this.init();
  }
  public registerSubClientService(servicePath: string, service: RPCService) {
    if (!this.stubClientServiceMap.has(servicePath)) {
      const newChannel = new WebSocketChannel(
        this.channelConnectionSend(this.stubConnection),
        servicePath,
        this.channelId++,
        'client-browser',
      );
      newChannel.serviceType = 'client';
      this.channelMap.set(newChannel.id, newChannel);
      newChannel.onOpen(() => {
        const serviceProxy = new RPCProxy(service);
        const messageConnection = createMessageConnection(
          new WebSocketMessageReader(newChannel),
          new WebSocketMessageWriter(newChannel),
        );
        serviceProxy.listen(messageConnection);

        if (!service.rpcClient) {
          service.rpcClient = [];
        }
        service.rpcClient.push(serviceProxy);
      });
      newChannel.open();

      this.stubClientServiceMap.set(servicePath, service);
    }
  }
  public async getStubService(servicePath: any, clientService?: RPCService): Promise<any> {
    const stubServiceProxy = await this.getStubServiceProxy(servicePath, clientService);
    return stubServiceProxy.createProxy();
  }

  private init() {
    this.initConnection();
  }
  private initConnection() {
    // const connection = new WebSocket(this.stubServiceAddr)
    const connection = this.stubConnection;
    connection.onmessage = ({data}) => {
      const msg = JSON.parse(data);
      const channel = this.channelMap.get(msg.id);
      if (channel) {
        channel.handleMessage(msg);
      } else {
        this.logger.log(`channel ${msg.id} not found`);
      }
    };
  }
  private channelConnectionSend = (connection: any) => {
    return (content: string) => {
      connection.send(content, (err: any) => {
        if (err) {
          this.logger.log(err);
        }
      });
    };
  }
  public getStubServiceProxy(servicePath: string, clientService?: RPCService): Promise<RPCProxy> {
    if (!this.stubServiceProxyMap.has(servicePath)) {
      const newChannel = new WebSocketChannel(
        this.channelConnectionSend(this.stubConnection),
        servicePath,
        this.channelId++,
        'client-browser',
      );
      newChannel.serviceType = 'server';
      this.channelMap.set(newChannel.id, newChannel);

      const channelPromise: Promise<RPCProxy> = new Promise((resolve) => {
        newChannel.onOpen(() => {
          const proxy = new RPCProxy(clientService);
          const messageConnection = createMessageConnection(
            new WebSocketMessageReader(newChannel),
            new WebSocketMessageWriter(newChannel),
          );

          proxy.listen(messageConnection);
          resolve(proxy);

        });
        newChannel.open();
      });
      this.stubServiceProxyMap.set(servicePath, channelPromise);
    }

    return this.stubServiceProxyMap.get(servicePath) as Promise<RPCProxy>;
  }
  // private registerClientService(){

  // }

}
