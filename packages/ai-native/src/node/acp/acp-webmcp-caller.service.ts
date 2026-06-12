import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';

import { AcpBrowserRpcRegistry } from './acp-browser-rpc-registry';

import type {
  IAcpWebMcpBridgeService,
  WebMcpGroupDef,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

interface WebMcpGroupDefinitionOptions {
  includeAllTools?: boolean;
}

/**
 * Node-side RPC caller service for WebMCP bridge calls.
 * Calls browser-side methods via RPC to retrieve group definitions and execute tools.
 *
 * Uses AcpBrowserRpcRegistry to bridge parent-injector consumers to the active
 * per-connection browser RPC service without changing core connection wiring.
 */
@Injectable()
export class AcpWebMcpCallerService extends RPCService<IAcpWebMcpBridgeService> {
  @Autowired(AcpBrowserRpcRegistry)
  private readonly browserRpcRegistry: AcpBrowserRpcRegistry;

  private getRpcClient(clientId?: string): IAcpWebMcpBridgeService | undefined {
    return this.client ?? this.browserRpcRegistry?.getWebMcpClient(clientId);
  }

  async getGroupDefinitions(options?: WebMcpGroupDefinitionOptions, clientId?: string): Promise<WebMcpGroupDef[]> {
    const rpcClient = this.getRpcClient(clientId);
    if (!rpcClient) {
      throw new Error('[AcpWebMcpCallerService] RPC client not available — browser connection not established');
    }
    return (rpcClient.$getGroupDefinitions as (options?: WebMcpGroupDefinitionOptions) => Promise<WebMcpGroupDef[]>)(
      options,
    );
  }

  async executeTool(
    group: string,
    tool: string,
    params: Record<string, unknown>,
    clientId?: string,
  ): Promise<WebMcpToolResult> {
    const rpcClient = this.getRpcClient(clientId);
    if (!rpcClient) {
      throw new Error('[AcpWebMcpCallerService] RPC client not available — browser connection not established');
    }
    return rpcClient.$executeTool(group, tool, params);
  }
}
