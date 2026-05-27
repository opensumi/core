import { Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';

import type { IAcpThreadStatusService } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

export const AcpThreadStatusCallerServiceToken = Symbol('AcpThreadStatusCallerServiceToken');

/**
 * Node-side service that pushes thread status changes to the browser via RPC.
 *
 * Uses the same staticRpcClient pattern as AcpPermissionCallerService
 * to bridge parent/child injector scopes.
 */
@Injectable()
export class AcpThreadStatusCallerService extends RPCService<IAcpThreadStatusService> {
  static staticRpcClient: IAcpThreadStatusService | undefined;

  static setStaticRpcClient(client: IAcpThreadStatusService | undefined): void {
    AcpThreadStatusCallerService.staticRpcClient = client;
  }

  private getRpcClient(): IAcpThreadStatusService | undefined {
    return this.client ?? AcpThreadStatusCallerService.staticRpcClient;
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
