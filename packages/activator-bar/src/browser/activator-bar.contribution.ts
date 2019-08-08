import { Domain, CommandContribution, CommandRegistry, Command } from '@ali/ide-core-browser';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ActivatorBar } from './activator-bar.view';
import { ActivatorBarRight } from './activator-bar.right.view';
import { Autowired } from '@ali/common-di';
import { ActivatorBarService } from './activator-bar.service';

export const TOGGLE_RIGHT_ACTIVITY_PANEL_COMMAND: Command = {
  id: 'activity-bar.right.toggle',
};

export const TOGGLE_LEFT_ACTIVITY_PANEL_COMMAND: Command = {
  id: 'activity-bar.left.toggle',
};

@Domain(LayoutContribution, CommandContribution)
export class ActivatorBarContribution implements LayoutContribution, CommandContribution {
  @Autowired()
  activityBarService: ActivatorBarService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-activator-bar/left', {
      component: ActivatorBar,
    });
    registry.register('@ali/ide-activator-bar/right', {
      component: ActivatorBarRight,
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(TOGGLE_RIGHT_ACTIVITY_PANEL_COMMAND, {
      execute: async (show?: boolean) => {
        const pTabbar = this.activityBarService.getTabbarWidget('right');
        if (show) {
          await pTabbar.widget.doOpen(null, null);
        } else {
          await pTabbar.widget.doCollapse();
        }
      },
    });
    registry.registerCommand(TOGGLE_LEFT_ACTIVITY_PANEL_COMMAND, {
      execute: async (show?: boolean) => {
        const pTabbar = this.activityBarService.getTabbarWidget('left');
        if (show) {
          await pTabbar.widget.doOpen(null, null);
        } else {
          await pTabbar.widget.doCollapse();
        }
      },
    });
  }
}
