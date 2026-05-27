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
 */
@Injectable()
export class AcpWebMcpCallerService extends RPCService<IAcpWebMcpBridgeService> {
  async getGroupDefinitions(): Promise<WebMcpGroupDef[]> {
    return this.client.$getGroupDefinitions();
  }

  async executeTool(group: string, tool: string, params: Record<string, unknown>): Promise<WebMcpToolResult> {
    return this.client.$executeTool(group, tool, params);
  }
}
