import {WebSocketHandler } from './ws';
import * as pathMatch from 'path-match';
import {IWebSocket} from '../common/websocket-channel';
import * as ws from 'ws';
const route = pathMatch();
import { RPCStub } from './stub';
import {WebSocketChannel} from '../common/websocket-channel';

/**
 * IMessage
 * {
 *  channelID?: string,
 *  content: any
 * }
 */

/*
export class WebSocketChannel implements IWebSocket {
  public id: number
  public servicePath: string
  public serviceType: 'client' | 'server'

  private connectionSend: (content: string) => void
  private fireMessage: (data: any) => void
  private fireOpen: () => void
  private stubClientId: string

  constructor(connectionSend, path, id, stubClientId){
    this.connectionSend = connectionSend
    this.servicePath = path
    this.id = id
    this.stubClientId = stubClientId
  }
  // server
  onMessage(cb: (data: any) => any){
    this.fireMessage = cb
  }
  onOpen(cb: ()=>void){
    this.fireOpen = cb
  }
  ready(){
    this.connectionSend(JSON.stringify({
      kind: 'ready',
      id: this.id
    }))
  }

  handleMessage(msg){
    if(msg.kind === 'ready'){
      console.log('handleMessage', msg, 'stubClientId', this.stubClientId)
      this.fireOpen()
    }else if(msg.kind === 'data'){
      this.fireMessage(msg.content)
    }
  }

  // client
  open(){
    this.connectionSend(JSON.stringify({
      kind: 'open',
      id: this.id,
      path: this.servicePath,
      stubClientId: this.stubClientId
    }))
  }
  send(content: string){
    this.connectionSend(JSON.stringify({
      kind: 'data',
      id: this.id,
      content
    }))
  }
  onError(){}
  onClose(){}
}
*/

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
    this.serviceWS = new ws.Server({noServer: true});
    this.serviceWS.on('connection', (connection: any) => {
      console.log('on connection');
      connection.on('message', async (msg: any) => {
        console.log('on msg', msg);
        try {
          msg = JSON.parse(msg);
          if (msg.kind === 'open') {
            const {id, path, stubClientId} = msg;

            const connectionSend = this.channelConnectionSend(connection);
            const newChannel = new WebSocketChannel(connectionSend, path, id, 'stub');

            if (await this.handleOpenStubService(path, newChannel, stubClientId)) {
              console.log('handleOpenStubService path', path);
              newChannel.serviceType = 'server';
              this.channelMap.set(id, newChannel);
              newChannel.ready();
            } else if (this.handleOpenStubClientService(path, newChannel, stubClientId)) {
              newChannel.serviceType = 'client';
              this.channelMap.set(id, newChannel);
              newChannel.ready();
            }

          } else {
            console.log('msg', msg);
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
    });
  }

  public handleUpgrade(wsPathname: string, request: any, socket: any, head: any): boolean {
    const routeResult = this.handlerRoute(wsPathname);

    if (routeResult) {
      console.log('routeResult', routeResult);
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
    console.log('servicePath', service, 'servicePath', servicePath);
    let handleResult = false;
    if (service) {
      await this.rpcStub.registerStubServiceProxy(servicePath, connection, stubClientId);
      handleResult = true;
    }

    return handleResult;
  }
}
