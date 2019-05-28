import {RPCProxy, RPCService} from '../common/proxy';
import {createMessageConnection, WebSocketMessageReader, WebSocketMessageWriter } from '@ali/vscode-jsonrpc';

// export interface RPCService{
//   register?(): () => Promise<any>
//   // servicePath: string

//   rpcClient?: IRPCProxyTarget[]
//   rpcRegistered?: boolean
// }

// export abstract class RPCService {
//   register?(): () => Promise<any>
//   // servicePath: string

//   rpcClient?: any[]
//   rpcRegistered?: boolean
// }

// interface IRPCProxy {
//   from: string
// }
// interface IRPCProxyTarget {
// }
type stubClientId = string;

interface ClientServiceProxyResolveType {
  resolve: (rpcProxy: RPCProxy) => void;
  clientService: RPCService | undefined;
}

export class RPCStub {
  private stubServiceMap: Map<string, RPCService> = new Map();
  private stubServiceProxyMap: Map<stubClientId, Map<string, RPCProxy>> = new Map();

  private clientServiceProxyPromiseMap: Map<string, Promise<RPCProxy>> = new Map();
  private clientServiceProxyResolveMap: Map<string, ClientServiceProxyResolveType> = new Map();
  private clientServiceProxy: Map<string, RPCProxy> = new Map();

  public registerStubService(servicePath: string, service: RPCService): void {
    this.stubServiceMap.set(servicePath, service);
  }

  public registerStubClientServiceProxy(servicePath: string, connection: any, stubClientId: string) {
    const messageConnection = this.createWebSocketMessageConnection(connection);

    if (this.clientServiceProxy.has(servicePath)) {
      const rpcProxy = this.clientServiceProxy.get(servicePath) as RPCProxy;
      rpcProxy.listen(messageConnection);
    } else if (this.clientServiceProxyResolveMap.has(servicePath)) {
      const {resolve, clientService} = this.clientServiceProxyResolveMap.get(servicePath) as ClientServiceProxyResolveType;
      const serviceProxy = new RPCProxy(clientService);
      serviceProxy.listen(messageConnection);
      this.clientServiceProxy.set(servicePath, serviceProxy);
      resolve(serviceProxy);
    }
  }
  public getRegisterClientService(servicePath: string) {
    return this.clientServiceProxyPromiseMap.get(servicePath);
  }
  public async getClientService(servicePath: string, clientService?: RPCService): Promise<any> {
    if (!this.clientServiceProxyPromiseMap.has(servicePath)) {
      const service = new Promise((resolve) => {
        this.clientServiceProxyResolveMap.set(servicePath, {
          resolve,
          clientService,
        });
      });
      this.clientServiceProxyPromiseMap.set(servicePath, service as Promise<RPCProxy>);
    }

    const stubClientServiceProxy = await this.clientServiceProxyPromiseMap.get(servicePath) as RPCProxy;
    return stubClientServiceProxy.createProxy();
  }

  public async registerStubServiceProxy(servicePath: string, connection: any, stubClientId: string) {
    const service = this.stubServiceMap.get(servicePath);
    if (service) {
      if (service.register && !service.rpcRegistered) {
        await service.register();
        service.rpcRegistered = true;
      }
      const serviceProxy = new RPCProxy(service);
      if (!this.stubServiceProxyMap.has(stubClientId)) {
        this.stubServiceProxyMap.set(stubClientId, new Map());
      }
      const clientServiceMap = this.stubServiceProxyMap.get(stubClientId) as Map<string, RPCProxy>;
      clientServiceMap.set(servicePath, serviceProxy); // TODO: 不同的 tab 同样的 service 名称

      const messageConnection = this.createWebSocketMessageConnection(connection);
      serviceProxy.listen(messageConnection);

      if (!service.rpcClient) {
        service.rpcClient = [];
      }
      service.rpcClient.push(serviceProxy.createProxy()); // createProxy
      return serviceProxy;
    } else {
      return null;
    }
  }
  createWebSocketMessageConnection(socket: any) {
    return createMessageConnection(
      new WebSocketMessageReader(socket),
      new WebSocketMessageWriter(socket),
    );
  }
  getStubServiceProxy(servicePath: string) {
    return this.stubServiceProxyMap.get(servicePath);
  }
  getStubService(servicePath: string) {
    const service = this.stubServiceMap.get(servicePath);
    return service;
  }

}
