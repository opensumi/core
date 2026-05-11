import { Autowired } from '@opensumi/di';
import { ClientAppContribution, Domain, localize, runWhenIdle } from '@opensumi/ide-core-browser';
import { IStatusBarService, StatusBarAlignment } from '@opensumi/ide-core-browser/lib/services/status-bar-service';

import { WORKSPACE_TRUST_EXIT_RESTRICTED_COMMAND } from './workspace-trust-command.contribution';
import { WorkspaceTrustService } from './workspace-trust.service';

const RESTRICTED_MODE_STATUSBAR_ID = 'workspace-trust.restricted-mode';

@Domain(ClientAppContribution)
export class WorkspaceTrustStatusBarContribution implements ClientAppContribution {
  @Autowired(WorkspaceTrustService)
  private readonly workspaceTrustService: WorkspaceTrustService;

  @Autowired(IStatusBarService)
  private readonly statusBarService: IStatusBarService;

  onStart() {
    runWhenIdle(() => {
      if (this.workspaceTrustService.isRestricted()) {
        this.statusBarService.addElement(RESTRICTED_MODE_STATUSBAR_ID, {
          text: `$(shield) ${localize('workspace.trust.statusbar.restricted', 'Restricted Mode')}`,
          alignment: StatusBarAlignment.RIGHT,
          tooltip: localize(
            'workspace.trust.statusbar.restricted.tooltip',
            'Restricted Mode - Some features are disabled for security',
          ),
          className: 'workspace-trust-restricted-status',
          command: WORKSPACE_TRUST_EXIT_RESTRICTED_COMMAND.id,
        });
      }
    });
  }
}
