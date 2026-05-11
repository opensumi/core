import { Autowired } from '@opensumi/di';
import { CommandContribution, CommandRegistry, CommandService, MessageType, localize } from '@opensumi/ide-core-common';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { IClientApp } from '../browser-module';
import { ClientAppContribution } from '../common/common.define';

import { WorkspaceTrustState } from './common';
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

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(WORKSPACE_TRUST_EXIT_RESTRICTED_COMMAND, {
      execute: async () => {
        const okText = localize('workspace.trust.exitRestricted.confirm.ok', 'Trust and Reload');
        const cancelText = localize('workspace.trust.exitRestricted.cancel', 'Cancel');

        const msg = await this.commandService.executeCommand<string>('dialog.open', {
          message: localize(
            'workspace.trust.exitRestricted.confirm.message',
            'Are you sure you want to trust the authors of the files in this workspace and exit Restricted Mode?',
          ),
          type: MessageType.Info,
          buttons: [okText, cancelText],
        });

        if (msg === okText) {
          await this.workspaceTrustService.setTrustState(WorkspaceTrustState.Trusted);
          this.clientApp.fireOnReload(true);
        }
      },
    });
  }

  onStart() {
    // no-op
  }
}
