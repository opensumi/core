import { Injectable } from '@opensumi/di';

import type { IDisposable } from '@opensumi/ide-core-common';
import type {
  IAcpPermissionService,
  IAcpThreadStatusService,
  IAcpWebMcpBridgeService,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

@Injectable()
export class AcpBrowserRpcRegistry {
  private readonly permissionClients = new Map<string, IAcpPermissionService>();
  private readonly threadStatusClients = new Map<string, IAcpThreadStatusService>();
  private readonly webMcpClients = new Map<string, IAcpWebMcpBridgeService>();

  registerPermissionClient(clientId: string, client: IAcpPermissionService): IDisposable {
    return this.registerClient(this.permissionClients, clientId, client);
  }

  getPermissionClient(clientId?: string): IAcpPermissionService | undefined {
    return this.getClient(this.permissionClients, clientId);
  }

  registerThreadStatusClient(clientId: string, client: IAcpThreadStatusService): IDisposable {
    return this.registerClient(this.threadStatusClients, clientId, client);
  }

  getThreadStatusClient(clientId?: string): IAcpThreadStatusService | undefined {
    return this.getClient(this.threadStatusClients, clientId);
  }

  registerWebMcpClient(clientId: string, client: IAcpWebMcpBridgeService): IDisposable {
    return this.registerClient(this.webMcpClients, clientId, client);
  }

  getWebMcpClient(clientId?: string): IAcpWebMcpBridgeService | undefined {
    return this.getClient(this.webMcpClients, clientId);
  }

  dispose(): void {
    this.permissionClients.clear();
    this.threadStatusClients.clear();
    this.webMcpClients.clear();
  }

  private registerClient<T>(clients: Map<string, T>, clientId: string, client: T): IDisposable {
    clients.delete(clientId);
    clients.set(clientId, client);

    return {
      dispose: () => {
        if (clients.get(clientId) === client) {
          clients.delete(clientId);
        }
      },
    };
  }

  private getClient<T>(clients: Map<string, T>, clientId?: string): T | undefined {
    if (clientId) {
      return clients.get(clientId);
    }

    let current: T | undefined;
    for (const client of clients.values()) {
      current = client;
    }
    return current;
  }
}
