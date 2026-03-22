import { Injectable, Provider } from '@opensumi/di';
import {
  AIBackSerivcePath,
  AIBackSerivceToken,
  AcpCliClientServiceToken,
  AcpPermissionServicePath,
} from '@opensumi/ide-core-common';
import { NodeModule } from '@opensumi/ide-core-node';

import { SumiMCPServerProxyServicePath, TokenMCPServerProxyService } from '../common';
import { ToolInvocationRegistryManager, ToolInvocationRegistryManagerImpl } from '../common/tool-invocation-registry';

// @ts-ignore
import {
  AcpAgentRequestHandler,
  // @ts-ignore
  AcpAgentRequestHandlerToken,
  AcpAgentService,
  AcpAgentServiceToken,
  AcpFileSystemHandler,
  // @ts-ignore
  AcpFileSystemHandlerToken,
  AcpPermissionCallerManager,
  AcpPermissionCallerManagerToken,
  AcpTerminalHandler,
  // @ts-ignore
  AcpTerminalHandlerToken,
  CliAgentProcessManager,
  CliAgentProcessManagerToken,
} from './acp';
import { AcpCliBackService } from './acp/acp-cli-back.service';
import { AcpCliClientService } from './acp/acp-cli-client.service';
import { SumiMCPServerBackend } from './mcp/sumi-mcp-server';

@Injectable()
export class AINativeModule extends NodeModule {
  providers: Provider[] = [
    {
      token: AIBackSerivceToken,
      useClass: AcpCliBackService,
    },
    {
      token: AcpCliClientServiceToken,
      useClass: AcpCliClientService,
    },
    {
      token: CliAgentProcessManagerToken,
      useClass: CliAgentProcessManager,
    },
    {
      token: AcpAgentServiceToken,
      useClass: AcpAgentService,
    },
    {
      token: AcpPermissionCallerManagerToken,
      useClass: AcpPermissionCallerManager,
    },
    {
      token: ToolInvocationRegistryManager,
      useClass: ToolInvocationRegistryManagerImpl,
    },
    {
      token: TokenMCPServerProxyService,
      useClass: SumiMCPServerBackend,
    },
    // {
    //   token: AcpFileSystemHandlerToken,
    //   useClass: AcpFileSystemHandler,
    // },
    // {
    //   token: AcpTerminalHandlerToken,
    //   useClass: AcpTerminalHandler,
    // },
    // {
    //   token: AcpAgentRequestHandlerToken,
    //   useClass: AcpAgentRequestHandler,
    // },
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
      token: AcpPermissionCallerManagerToken,
    },
  ];
}
