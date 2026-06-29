import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';

import { AcpBrowserRpcRegistry } from './acp-browser-rpc-registry';

import type { IAcpThreadStatusService } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export const AcpThreadStatusCallerServiceToken = Symbol('AcpThreadStatusCallerServiceToken');

/**
 * Node-side service that pushes thread status changes to the browser via RPC.
 *
 * Uses AcpBrowserRpcRegistry to reach the active per-connection browser RPC
 * bridge from parent-injector consumers.
 */
@Injectable()
export class AcpThreadStatusCallerService extends RPCService<IAcpThreadStatusService> {
  @Autowired(AcpBrowserRpcRegistry)
  private readonly browserRpcRegistry: AcpBrowserRpcRegistry;

  private getRpcClient(): IAcpThreadStatusService | undefined {
    return this.client ?? this.browserRpcRegistry?.getThreadStatusClient();
  }

  notifyThreadStatusChange(sessionId: string, status: string): void {
    const rpcClient = this.getRpcClient();
    if (rpcClient) {
      rpcClient.$onThreadStatusChange(sessionId, status).catch(() => {
        // Silently ignore — browser may not be ready
      });
    }
  }
}
