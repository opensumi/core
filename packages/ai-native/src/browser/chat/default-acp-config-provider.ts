import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService, QuickPickService } from '@opensumi/ide-core-browser';
import {
  AINativeSettingSectionsId,
  AcpTargetConfigRequest,
  AgentProcessConfig,
  DEFAULT_ACP_THREAD_POOL_SIZE,
  IACPConfigProvider,
  MCPConfigServiceToken,
  URI,
} from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { buildAcpAgentProcessConfig } from '../acp/build-agent-process-config';
import { MCPConfigService } from '../mcp/config/mcp-config.service';

import { getAgentConfig, getDefaultAgentType } from './get-default-agent-type';
import { getCachedWorkspaceDir, pickWorkspaceDir } from './pick-workspace-dir';

/**
 * Default implementation of IACPConfigProvider.
 * Builds AgentProcessConfig from preferences and workspace context.
 * Downstream projects can extend this class to customize config construction
 * (e.g., inject custom env vars, override command paths, add validation).
 */
@Injectable()
export class DefaultACPConfigProvider implements IACPConfigProvider {
  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(QuickPickService)
  protected readonly quickPick: QuickPickService;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  @Autowired(MCPConfigServiceToken)
  protected readonly mcpConfigService: MCPConfigService;

  async resolveConfig(): Promise<AgentProcessConfig> {
    await this.workspaceService.whenReady;
    const agentType = getDefaultAgentType(this.preferenceService);
    const workspaceDir = await pickWorkspaceDir(this.workspaceService, this.quickPick, this.messageService);

    return this.buildConfig({ agentId: agentType, cwd: workspaceDir });
  }

  async resolveConfigForTarget(request: AcpTargetConfigRequest): Promise<AgentProcessConfig> {
    await this.workspaceService.whenReady;

    return this.buildConfig(request);
  }

  async resolvePrewarmConfig(): Promise<AgentProcessConfig | undefined> {
    await this.workspaceService.whenReady;

    const cachedWorkspaceDir = getCachedWorkspaceDir();
    if (cachedWorkspaceDir) {
      return this.buildConfig({
        agentId: getDefaultAgentType(this.preferenceService),
        cwd: cachedWorkspaceDir,
      });
    }

    // Background startup must never show the multi-root cwd picker or choose
    // a root on the user's behalf. The first ACP interaction retains the
    // existing selection flow.
    if (this.workspaceService.isMultiRootWorkspaceOpened || !this.workspaceService.workspace) {
      return undefined;
    }

    return this.buildConfig({
      agentId: getDefaultAgentType(this.preferenceService),
      cwd: new URI(this.workspaceService.workspace.uri).codeUri.fsPath,
    });
  }

  private async buildConfig(request: AcpTargetConfigRequest): Promise<AgentProcessConfig> {
    const agentConfig = getAgentConfig(this.preferenceService, request.agentId);
    const mcpServers = await this.mcpConfigService.getACPServers();
    const webMcpEnabled = await this.mcpConfigService.isBuiltinMCPEnabled();

    return buildAcpAgentProcessConfig({
      agentId: request.agentId,
      registration: {
        command: agentConfig.command,
        args: agentConfig.args,
        cwd: request.cwd,
      },
      userPreferences: {
        nodePath: this.preferenceService.get('ai-native.acp.nodePath', ''),
        agents: this.preferenceService.get('ai-native.acp.agents', {}),
        threadPoolSize: this.preferenceService.get(
          AINativeSettingSectionsId.AcpThreadPoolSize,
          DEFAULT_ACP_THREAD_POOL_SIZE,
        ),
        webMcpEnabled,
      },
      mcpServers,
    });
  }
}
