import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection/lib/common/rpc-service';
import { WebMcpGroupRegistryToken } from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

import type { WebMcpGroupDefinitionOptions, WebMcpGroupRegistry } from './webmcp-group-registry';
import type {
  IAcpWebMcpBridgeService,
  WebMcpGroupDef,
  WebMcpToolResult,
} from '@opensumi/ide-core-common/lib/types/ai-native/acp-types';

/**
 * Browser-side RPC service for WebMCP bridge calls.
 * Receives RPC calls from the Node layer and delegates to the group registry.
 */
@Injectable()
export class AcpWebMcpRpcService extends RPCService implements IAcpWebMcpBridgeService {
  @Autowired(WebMcpGroupRegistryToken)
  private readonly registry: WebMcpGroupRegistry;

  async $getGroupDefinitions(options?: WebMcpGroupDefinitionOptions): Promise<WebMcpGroupDef[]> {
    return this.registry.getGroupDefinitions(options);
  }

  async $executeTool(group: string, tool: string, params: Record<string, unknown>): Promise<WebMcpToolResult> {
    return this.registry.executeTool(group, tool, params);
  }
}
