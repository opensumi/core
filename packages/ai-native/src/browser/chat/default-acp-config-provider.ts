import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService, QuickPickService } from '@opensumi/ide-core-browser';
import { AgentProcessConfig, IACPConfigProvider } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { getAgentConfig, getDefaultAgentType } from './get-default-agent-type';
import { pickWorkspaceDir } from './pick-workspace-dir';

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

  async resolveConfig(): Promise<AgentProcessConfig> {
    await this.workspaceService.whenReady;
    const agentType = getDefaultAgentType(this.preferenceService);
    const agentConfig = getAgentConfig(this.preferenceService, agentType);
    const workspaceDir = await pickWorkspaceDir(this.workspaceService, this.quickPick, this.messageService);
    return { ...agentConfig, workspaceDir };
  }
}
