import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  Domain,
  IClientApp,
  localize,
} from '@opensumi/ide-core-browser';
import { IDialogService } from '@opensumi/ide-overlay';

import { WorkspaceTrustService } from './workspace-trust.service';

export const WORKSPACE_TRUST_EXIT_RESTRICTED_COMMAND = {
  id: 'workspace.trust.exitRestricted',
  label: localize('workspace.trust.exitRestricted.label', 'Exit Restricted Mode'),
};

@Domain(CommandContribution, ClientAppContribution)
export class WorkspaceTrustCommandContribution implements CommandContribution, ClientAppContribution {
  @Autowired(WorkspaceTrustService)
  private readonly workspaceTrustService: WorkspaceTrustService;

  @Autowired(IClientApp)
  private readonly clientApp: IClientApp;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(WORKSPACE_TRUST_EXIT_RESTRICTED_COMMAND, {
      execute: async () => {
        const okText = localize('workspace.trust.exitRestricted.confirm.ok', 'Trust and Reload');
        const cancelText = localize('workspace.trust.exitRestricted.cancel', 'Cancel');

        const msg = await this.dialogService.open({
          message: localize(
            'workspace.trust.exitRestricted.confirm.message',
            'Are you sure you want to trust the authors of the files in this workspace and exit Restricted Mode?',
          ),
          type: 1, // MessageType.Info
          buttons: [okText, cancelText],
        });

        if (msg === okText) {
          await this.workspaceTrustService.setTrustState('trusted' as any);
          this.clientApp.fireOnReload(true);
        }
      },
    });
  }

  onStart() {
    // no-op
  }
}
