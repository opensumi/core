import { Autowired, Injectable } from '@opensumi/di';
import { CLIENT_ID_TOKEN } from '@opensumi/ide-core-common';

import { AcpBrowserRpcRegistry } from './acp-browser-rpc-registry';

import type { IDisposable } from '@opensumi/ide-core-common';
import type {
  IAcpPermissionService,
  IAcpThreadStatusService,
  IAcpWebMcpBridgeService,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export const AcpPermissionRpcBridgeServiceToken = Symbol('AcpPermissionRpcBridgeServiceToken');
export const AcpThreadStatusRpcBridgeServiceToken = Symbol('AcpThreadStatusRpcBridgeServiceToken');
export const AcpWebMcpRpcBridgeServiceToken = Symbol('AcpWebMcpRpcBridgeServiceToken');

@Injectable()
export class AcpPermissionRpcBridgeService {
  @Autowired(CLIENT_ID_TOKEN)
  private readonly clientId: string;

  @Autowired(AcpBrowserRpcRegistry)
  private readonly browserRpcRegistry: AcpBrowserRpcRegistry;

  private clients: IAcpPermissionService[] | undefined;
  private registration: IDisposable | undefined;

  set rpcClient(clients: IAcpPermissionService[] | undefined) {
    this.clients = clients;
    this.registration?.dispose();
    this.registration = undefined;

    const client = clients?.[0];
    if (client) {
      this.registration = this.browserRpcRegistry.registerPermissionClient(this.clientId, client);
    }
  }

  get rpcClient(): IAcpPermissionService[] | undefined {
    return this.clients;
  }

  dispose(): void {
    this.registration?.dispose();
    this.registration = undefined;
    this.clients = undefined;
  }
}

@Injectable()
export class AcpThreadStatusRpcBridgeService {
  @Autowired(CLIENT_ID_TOKEN)
  private readonly clientId: string;

  @Autowired(AcpBrowserRpcRegistry)
  private readonly browserRpcRegistry: AcpBrowserRpcRegistry;

  private clients: IAcpThreadStatusService[] | undefined;
  private registration: IDisposable | undefined;

  set rpcClient(clients: IAcpThreadStatusService[] | undefined) {
    this.clients = clients;
    this.registration?.dispose();
    this.registration = undefined;

    const client = clients?.[0];
    if (client) {
      this.registration = this.browserRpcRegistry.registerThreadStatusClient(this.clientId, client);
    }
  }

  get rpcClient(): IAcpThreadStatusService[] | undefined {
    return this.clients;
  }

  dispose(): void {
    this.registration?.dispose();
    this.registration = undefined;
    this.clients = undefined;
  }
}

@Injectable()
export class AcpWebMcpRpcBridgeService {
  @Autowired(CLIENT_ID_TOKEN)
  private readonly clientId: string;

  @Autowired(AcpBrowserRpcRegistry)
  private readonly browserRpcRegistry: AcpBrowserRpcRegistry;

  private clients: IAcpWebMcpBridgeService[] | undefined;
  private registration: IDisposable | undefined;

  set rpcClient(clients: IAcpWebMcpBridgeService[] | undefined) {
    this.clients = clients;
    this.registration?.dispose();
    this.registration = undefined;

    const client = clients?.[0];
    if (client) {
      this.registration = this.browserRpcRegistry.registerWebMcpClient(this.clientId, client);
    }
  }

  get rpcClient(): IAcpWebMcpBridgeService[] | undefined {
    return this.clients;
  }

  dispose(): void {
    this.registration?.dispose();
    this.registration = undefined;
    this.clients = undefined;
  }
}
