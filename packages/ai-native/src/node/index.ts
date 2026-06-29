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
  AcpBrowserRpcRegistry,
  AcpFileSystemHandler,
  AcpFileSystemHandlerToken,
  AcpPermissionCallerService,
  AcpPermissionCallerServiceToken,
  AcpPermissionRpcBridgeService,
  AcpPermissionRpcBridgeServiceToken,
  AcpTerminalHandler,
  AcpTerminalHandlerToken,
  AcpThreadFactoryProvider,
  AcpThreadStatusCallerService,
  AcpThreadStatusCallerServiceToken,
  AcpThreadStatusRpcBridgeService,
  AcpThreadStatusRpcBridgeServiceToken,
  AcpWebMcpCallerService,
  AcpWebMcpRpcBridgeService,
  AcpWebMcpRpcBridgeServiceToken,
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
    AcpBrowserRpcRegistry,
    {
      token: AcpPermissionRpcBridgeServiceToken,
      useClass: AcpPermissionRpcBridgeService,
    },
    {
      token: AcpThreadStatusRpcBridgeServiceToken,
      useClass: AcpThreadStatusRpcBridgeService,
    },
    {
      token: AcpWebMcpRpcBridgeServiceToken,
      useClass: AcpWebMcpRpcBridgeService,
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
      token: AcpPermissionRpcBridgeServiceToken,
    },
    {
      servicePath: AcpThreadStatusServicePath,
      token: AcpThreadStatusRpcBridgeServiceToken,
    },
    {
      servicePath: AcpWebMcpBridgePath,
      token: AcpWebMcpRpcBridgeServiceToken,
    },
  ];
}
