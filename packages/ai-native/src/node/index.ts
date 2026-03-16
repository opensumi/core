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

import {
  AcpAgentRequestHandler,
  AcpAgentService,
  AcpAgentServiceToken,
  AcpFileSystemHandler,
  AcpPermissionCallerManager,
  AcpPermissionCallerManagerToken,
  AcpTerminalHandler,
  CliAgentProcessManager,
  CliAgentProcessManagerToken,
} from './acp';
import { AcpCliBackService, AcpCliBackServiceToken } from './acp/acp-cli-back.service';
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
      token: AcpCliBackServiceToken,
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
      token: AIBackSerivceToken,
      useClass: AcpCliBackService,
    },
    {
      token: ToolInvocationRegistryManager,
      useClass: ToolInvocationRegistryManagerImpl,
    },
    {
      token: TokenMCPServerProxyService,
      useClass: SumiMCPServerBackend,
    },
    AcpFileSystemHandler,
    AcpTerminalHandler,
    AcpAgentRequestHandler,
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
