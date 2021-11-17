import { Autowired } from '@ide-framework/common-di';
import { Domain, CommandContribution } from '@ide-framework/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ide-framework/ide-core-browser/lib/layout';
import { CommandRegistry } from '@ide-framework/ide-core-common';

import { StatusBarView } from './status-bar.view';
import { IStatusBarService } from '../common';
import { StatusBarEntry, StatusBarCommand } from '@ide-framework/ide-core-browser/lib/services';

@Domain(ComponentContribution, CommandContribution)
export class StatusBarContribution implements ComponentContribution, CommandContribution {
  @Autowired(IStatusBarService)
  statusBarService: IStatusBarService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ide-framework/ide-status-bar', {
      component: StatusBarView,
      id: 'ide-status-bar',
    }, {
      size: 24,
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(StatusBarCommand.changeBackgroundColor, {
      execute: (backgroundColor: string) => {
        return this.statusBarService.setBackgroundColor(backgroundColor);
      },
    });

    commands.registerCommand(StatusBarCommand.changeColor, {
      execute: (color: string) => {
        return this.statusBarService.setColor(color);
      },
    });

    commands.registerCommand(StatusBarCommand.addElement, {
      execute: (id: string, entry: StatusBarEntry) => {
        return this.statusBarService.addElement(id, entry);
      },
    });

    commands.registerCommand(StatusBarCommand.toggleElement, {
      execute: (entryId: string) => {
        this.statusBarService.toggleElement(entryId);
      },
    });
  }
}
