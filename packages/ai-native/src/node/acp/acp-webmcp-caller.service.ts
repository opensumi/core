import { Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';

import type {
  IAcpWebMcpBridgeService,
  WebMcpGroupDef,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

/**
 * Node-side RPC caller service for WebMCP bridge calls.
 * Calls browser-side methods via RPC to retrieve group definitions and execute tools.
 *
 * Uses the same staticRpcClient pattern as AcpPermissionCallerService
 * to bridge parent/child injector scopes: the child-injector instance
 * (created by bindModuleBackService) gets this.client set, while
 * parent-injector consumers need the static fallback.
 */
@Injectable()
export class AcpWebMcpCallerService extends RPCService<IAcpWebMcpBridgeService> {
  static staticRpcClient: IAcpWebMcpBridgeService | undefined;

  static setStaticRpcClient(client: IAcpWebMcpBridgeService | undefined): void {
    AcpWebMcpCallerService.staticRpcClient = client;
  }

  private getRpcClient(): IAcpWebMcpBridgeService | undefined {
    return this.client ?? AcpWebMcpCallerService.staticRpcClient;
  }

  async getGroupDefinitions(): Promise<WebMcpGroupDef[]> {
    const rpcClient = this.getRpcClient();
    if (!rpcClient) {
      throw new Error('[AcpWebMcpCallerService] RPC client not available — browser connection not established');
    }
    return rpcClient.$getGroupDefinitions();
  }

  async executeTool(group: string, tool: string, params: Record<string, unknown>): Promise<WebMcpToolResult> {
    const rpcClient = this.getRpcClient();
    if (!rpcClient) {
      throw new Error('[AcpWebMcpCallerService] RPC client not available — browser connection not established');
    }
    return rpcClient.$executeTool(group, tool, params);
  }
}
