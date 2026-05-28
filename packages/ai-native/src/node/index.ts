import { Injectable, Provider } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AIBackSerivceToken,
  AcpPermissionServicePath,
  AcpThreadStatusServicePath,
  AcpWebMcpBridgePath,
  AcpWebMcpCallerServiceToken,
} from '@opensumi/ide-core-common';
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
  AcpThreadStatusCallerService,
  AcpThreadStatusCallerServiceToken,
  AcpWebMcpCallerService,
  OpenSumiMcpHttpServer,
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
    // Permission routing for multi-session permission requests
    {
      token: PermissionRoutingServiceToken,
      useClass: PermissionRoutingService,
    },
    // Thread status notification caller (Node → Browser)
    {
      token: AcpThreadStatusCallerServiceToken,
      useClass: AcpThreadStatusCallerService,
    },
    // WebMCP bridge caller (Node → Browser)
    {
      token: AcpWebMcpCallerServiceToken,
      useClass: AcpWebMcpCallerService,
    },
    // Built-in HTTP MCP server for exposing WebMCP tools to ACP agents
    OpenSumiMcpHttpServer,
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
    {
      servicePath: AcpThreadStatusServicePath,
      token: AcpThreadStatusCallerServiceToken,
    },
    {
      servicePath: AcpWebMcpBridgePath,
      token: AcpWebMcpCallerServiceToken,
    },
  ];
}
