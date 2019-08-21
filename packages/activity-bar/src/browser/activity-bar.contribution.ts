import { Domain, CommandContribution, CommandRegistry, Command, KeybindingContribution } from '@ali/ide-core-browser';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ActivityBar } from './activity-bar.view';
import { ActivityBarRight } from './activity-bar.right.view';
import { Autowired } from '@ali/common-di';
import { ActivityBarService } from './activity-bar.service';

export const TOGGLE_RIGHT_ACTIVITY_PANEL_COMMAND: Command = {
  id: 'activity-bar.right.toggle',
};

export const TOGGLE_LEFT_ACTIVITY_PANEL_COMMAND: Command = {
  id: 'activity-bar.left.toggle',
};

@Domain(LayoutContribution, CommandContribution, KeybindingContribution)
export class ActivityBarContribution implements LayoutContribution, CommandContribution, KeybindingContribution {
  @Autowired()
  activityBarService: ActivityBarService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-activity-bar/left', {
      id: 'ide-activity-bar/left',
      component: ActivityBar,
    });
    registry.register('@ali/ide-activity-bar/right', {
      id: 'ide-activity-bar/right',
      component: ActivityBarRight,
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(TOGGLE_RIGHT_ACTIVITY_PANEL_COMMAND, {
      execute: async (show?: boolean, size?: number) => {
        const pTabbar = this.activityBarService.getTabbarWidget('right');
        if (show) {
          await pTabbar.widget.doOpen(null, null, size);
        } else {
          await pTabbar.widget.doCollapse();
        }
      },
    });
    registry.registerCommand(TOGGLE_LEFT_ACTIVITY_PANEL_COMMAND, {
      execute: async (show?: boolean, size?: number) => {
        const pTabbar = this.activityBarService.getTabbarWidget('left');
        if (show) {
          await pTabbar.widget.doOpen(null, null, size);
        } else {
          await pTabbar.widget.doCollapse();
        }
      },
    });
  }

  registerKeybindings(keybindings) {
    keybindings.registerKeybinding({
      command: TOGGLE_RIGHT_ACTIVITY_PANEL_COMMAND.id,
      keybinding: 'ctrlcmd+k shift+r',
    });
    keybindings.registerKeybinding({
      command: TOGGLE_LEFT_ACTIVITY_PANEL_COMMAND.id,
      keybinding: 'ctrlcmd+shift+l',
    });
  }
}
