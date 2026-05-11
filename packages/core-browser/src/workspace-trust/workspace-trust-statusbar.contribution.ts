import { Autowired } from '@opensumi/di';
import { localize, runWhenIdle } from '@opensumi/ide-core-common';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { ClientAppContribution } from '../common/common.define';
import { IStatusBarService, StatusBarAlignment } from '../services/status-bar-service';

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
    runWhenIdle(async () => {
      await this.workspaceTrustService.whenTrustDecided();
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
