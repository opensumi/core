import { Autowired } from '@ali/common-di';
import { Domain, CommandContribution } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { CommandRegistry } from '@ali/ide-core-common';

import { StatusBarView } from './status-bar.view';
import { IStatusBarService } from '../common';

class StatusBarCommand {
  static changeColor = {
    id: 'statusbar.changeColor',
  };
}

@Domain(ComponentContribution, CommandContribution)
export class StatusBarContribution implements ComponentContribution, CommandContribution {
  @Autowired(IStatusBarService)
  statusBarService: IStatusBarService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-status-bar', {
      component: StatusBarView,
      id: 'ide-status-bar',
    }, {
      size: 24,
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(StatusBarCommand.changeColor, {
      execute: (color: string) => {
        return this.statusBarService.setBackgroundColor(color);
      },
    });
  }
}
