import { Injectable, Provider } from '@opensumi/di';
import { AIBackSerivcePath, AIBackSerivceToken, AcpPermissionServicePath } from '@opensumi/ide-core-common';
import { NodeModule } from '@opensumi/ide-core-node';

import { SumiMCPServerProxyServicePath, TokenMCPServerProxyService } from '../common';
import { ToolInvocationRegistryManager, ToolInvocationRegistryManagerImpl } from '../common/tool-invocation-registry';

import {
  AcpAgentRequestHandler,
  AcpAgentRequestHandlerToken,
  AcpAgentService,
  AcpAgentServiceToken,
  AcpFileSystemHandler,
  AcpFileSystemHandlerToken,
  AcpPermissionCallerService,
  AcpPermissionCallerServiceToken,
  AcpTerminalHandler,
  AcpTerminalHandlerToken,
  AcpThreadFactoryProvider,
  PermissionRoutingService,
  PermissionRoutingServiceToken,
} from './acp';
import { AcpCliBackService } from './acp/acp-cli-back.service';
import { SumiMCPServerBackend } from './mcp/sumi-mcp-server';
import { OpenAICompatibleModel } from './openai-compatible/openai-compatible-language-model';

@Injectable()
export class AINativeModule extends NodeModule {
  providers: Provider[] = [
    {
      token: AIBackSerivceToken,
      useClass: AcpCliBackService,
    },
    {
      token: AcpAgentServiceToken,
      useClass: AcpAgentService,
    },
    {
      token: AcpPermissionCallerServiceToken,
      useClass: AcpPermissionCallerService,
    },
    {
      token: ToolInvocationRegistryManager,
      useClass: ToolInvocationRegistryManagerImpl,
    },
    {
      token: TokenMCPServerProxyService,
      useClass: SumiMCPServerBackend,
    },
    {
      token: AcpFileSystemHandlerToken,
      useClass: AcpFileSystemHandler,
    },
    {
      token: AcpTerminalHandlerToken,
      useClass: AcpTerminalHandler,
    },
    {
      token: AcpAgentRequestHandlerToken,
      useClass: AcpAgentRequestHandler,
    },
    // Thread factory for creating AcpThread instances
    AcpThreadFactoryProvider,
    // Language models for non-ACP fallback
    OpenAICompatibleModel,
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
    {
      servicePath: AcpPermissionServicePath,
      token: AcpPermissionCallerServiceToken,
    },
    // Permission routing must be in backServices (not providers) so it
    // receives the child-injector AcpPermissionCallerService instance
    // that has rpcClient set by the RPC connection.
    {
      token: PermissionRoutingServiceToken,
      useClass: PermissionRoutingService,
    },
  ];
}
