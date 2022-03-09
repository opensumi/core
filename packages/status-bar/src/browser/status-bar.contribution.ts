import { Autowired } from '@opensumi/di';
import { Domain, CommandContribution } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { StatusBarEntry, StatusBarCommand } from '@opensumi/ide-core-browser/lib/services';
import { CommandRegistry } from '@opensumi/ide-core-common';

import { IStatusBarService } from '../common';

import { StatusBarView } from './status-bar.view';

@Domain(ComponentContribution, CommandContribution)
export class StatusBarContribution implements ComponentContribution, CommandContribution {
  @Autowired(IStatusBarService)
  statusBarService: IStatusBarService;

  registerComponent(registry: ComponentRegistry) {
    registry.register(
      '@opensumi/ide-status-bar',
      {
        component: StatusBarView,
        id: 'ide-status-bar',
      },
      {
        size: 24,
      },
    );
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(StatusBarCommand.changeBackgroundColor, {
      execute: (backgroundColor: string) => this.statusBarService.setBackgroundColor(backgroundColor),
    });

    commands.registerCommand(StatusBarCommand.changeColor, {
      execute: (color: string) => this.statusBarService.setColor(color),
    });

    commands.registerCommand(StatusBarCommand.addElement, {
      execute: (id: string, entry: StatusBarEntry) => this.statusBarService.addElement(id, entry),
    });

    commands.registerCommand(StatusBarCommand.toggleElement, {
      execute: (entryId: string) => {
        this.statusBarService.toggleElement(entryId);
      },
    });
  }
}
