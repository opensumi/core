import { Autowired } from '@opensumi/di';
import { AppConfig, ClientAppContribution, Domain, ILogger } from '@opensumi/ide-core-browser';

import { WorkspaceTrustService } from './workspace-trust.service';

@Domain(ClientAppContribution)
export class WorkspaceTrustContribution implements ClientAppContribution {
  @Autowired(WorkspaceTrustService)
  private readonly workspaceTrustService: WorkspaceTrustService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  async initialize() {
    const workspacePath = this.appConfig.workspaceDir;
    if (!workspacePath) {
      this.logger.log('[workspace-trust] No workspace directory, skipping trust check');
      return;
    }

    this.logger.log(`[workspace-trust] Initializing trust check for: ${workspacePath}`);

    // Initialize storage and load existing trust state
    await this.workspaceTrustService.initialize(workspacePath);

    // If no saved trust state, show dialog
    if (this.workspaceTrustService.getTrustState() === ('undecided' as any)) {
      await this.workspaceTrustService.ensureTrustDecided();
    }

    if (this.workspaceTrustService.isRestricted()) {
      this.logger.log('[workspace-trust] Workspace is in restricted mode');
    } else {
      this.logger.log('[workspace-trust] Workspace is trusted');
    }
  }
}
