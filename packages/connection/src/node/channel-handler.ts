import {WebSocketHandler } from './ws';
import * as pathMatch from 'path-match';
import * as ws from 'ws';
const route = pathMatch();
import { RPCStub } from './stub';
import {WebSocketChannel} from '../common/websocket-channel';

export class ChannelHandler extends WebSocketHandler {
  public handlerId = 'base-channel';
  private serviceWS: ws.Server;
  private handlerRoute: (wsPathname: string) => any;
  private channelMap: Map<number, WebSocketChannel> = new Map();
  private rpcStub: RPCStub;

  constructor(routePath: string, rpcStub: RPCStub) {
    super();
    this.handlerRoute = route(routePath);
    this.rpcStub = rpcStub;

    this.initWS();
  }
  public initWS() {
    console.log('init ChannelHandler');
    this.serviceWS = new ws.Server({noServer: true});
    this.serviceWS.on('connection', (connection: any) => {
      connection.on('message', async (msg: any) => {
        try {
          msg = JSON.parse(msg);
          if (msg.kind === 'open') {
            const {id, path, stubClientId} = msg;

            const connectionSend = this.channelConnectionSend(connection);
            // TODO: channelId 放置在后端生成，多个 tab 下生成的 id 是重复的
            const newChannel = new WebSocketChannel(connectionSend, path, id, 'stub');

            const handleStubServiceResult = await this.handleOpenStubService(path, newChannel, stubClientId);

            if (handleStubServiceResult) {
              const {service, proxyIndex} = handleStubServiceResult;
              newChannel.serviceType = 'server';
              this.channelMap.set(id, newChannel);
              newChannel.onClose(() => {
                console.log('proxyIndex - 1', proxyIndex - 1);
                service.rpcClient.splice(proxyIndex - 1, 1);
              });
              newChannel.ready();
            } else if (this.handleOpenStubClientService(path, newChannel, stubClientId)) {
              newChannel.serviceType = 'client';
              this.channelMap.set(id, newChannel);
              newChannel.ready();
            }

          } else {
            const {id} = msg;
            const channel = this.channelMap.get(id);
            if (channel) {
              channel.handleMessage(msg);
            } else {
              console.log(`channel ${id} not found`);
            }

          }
        } catch (e) {
          console.log(e);
        }
      });
      connection.on('close', (code, reason) => {
        console.log('connection close');
        for (const channel of this.channelMap.values()) {
          channel.close(code, reason);
        }
        this.channelMap.clear();
      });
    });
  }

  public handleUpgrade(wsPathname: string, request: any, socket: any, head: any): boolean {
    const routeResult = this.handlerRoute(wsPathname);

    if (routeResult) {
      const serviceWS = this.serviceWS;
      serviceWS.handleUpgrade(request, socket, head, (connection: any) => {
        connection.routeParam = {
          pathname: wsPathname,
        };

        serviceWS.emit('connection', connection);
      });
      return true;
    }

    return false;
  }

  private channelConnectionSend = (connection: any) => {
    return (content: string) => {
      connection.send(content, (err: any) => {
        if (err) {
          console.log(err);
        }
      });
    };
  }
  private handleOpenStubClientService(servicePath: string, connection: any, stubClientId: string) {
    const registerClientService = this.rpcStub.getRegisterClientService(servicePath);
    let handleResult = false;
    if (registerClientService) {
      handleResult = true;
      this.rpcStub.registerStubClientServiceProxy(servicePath, connection, stubClientId);
    }

    return handleResult;
  }
  private async handleOpenStubService(servicePath: string, connection: any, stubClientId: string) {
    const service = this.rpcStub.getStubService(servicePath);
    let handleResult;
    if (service) {
      handleResult = await this.rpcStub.registerStubServiceProxy(servicePath, connection, stubClientId);
      // handleResult = true;
    }

    return handleResult;
  }
}
