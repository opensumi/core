import { Injectable, Provider } from '@opensumi/di';
import { AIBackSerivcePath, AIBackSerivceToken } from '@opensumi/ide-core-common';
import { NodeModule } from '@opensumi/ide-core-node';
import { BaseAIBackService } from '@opensumi/ide-core-node/lib/ai-native/base-back.service';

import { SumiMCPServerProxyServicePath, TokenMCPServerProxyService } from '../common';
import { MCPServerManager, MCPServerManagerPath } from '../common/mcp-server-manager';
import { ToolInvocationRegistryManager, ToolInvocationRegistryManagerImpl } from '../common/tool-invocation-registry';

import { SumiMCPServerBackend } from './mcp/sumi-mcp-server';
import { MCPServerManagerImpl } from './mcp-server-manager-impl';

@Injectable()
export class AINativeModule extends NodeModule {
  providers: Provider[] = [
    {
      token: AIBackSerivceToken,
      useClass: BaseAIBackService,
    },
    {
      token: MCPServerManager,
      useClass: MCPServerManagerImpl,
    },
    {
      token: ToolInvocationRegistryManager,
      useClass: ToolInvocationRegistryManagerImpl,
    },
    {
      token: TokenMCPServerProxyService,
      useClass: SumiMCPServerBackend,
    },
  ];

  backServices = [
    {
      servicePath: AIBackSerivcePath,
      token: AIBackSerivceToken,
    },
    // {
    //   servicePath: MCPServerManagerPath,
    //   token: MCPServerManager,
    // },
    {
      servicePath: SumiMCPServerProxyServicePath,
      token: TokenMCPServerProxyService,
    },
  ];
}
