import { Domain, CommandContribution, CommandRegistry, Command, KeybindingContribution, ClientAppContribution } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ActivityBar } from './activity-bar.view';
import { ActivityBarRight } from './activity-bar.right.view';
import { Autowired } from '@ali/common-di';
import { ActivityBarService } from './activity-bar.service';
import { ActivityBarBottom } from './activity-bar.bottom.view';
// import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { StatusBarAlignment, IStatusBarService} from '@ali/ide-core-browser/lib/services';

export const TOGGLE_RIGHT_ACTIVITY_PANEL_COMMAND: Command = {
  id: 'activity-bar.right.toggle',
};

export const TOGGLE_LEFT_ACTIVITY_PANEL_COMMAND: Command = {
  id: 'activity-bar.left.toggle',
};

@Domain(ClientAppContribution, ComponentContribution, CommandContribution, KeybindingContribution)
export class ActivityBarContribution implements ClientAppContribution, ComponentContribution, CommandContribution, KeybindingContribution {
  @Autowired()
  activityBarService: ActivityBarService;

  @Autowired(IStatusBarService)
  statusBar: IStatusBarService;

  onStart() {
    this.statusBar.addElement('bottom-panel-handle', {
      icon: 'window-maximize',
      alignment: StatusBarAlignment.RIGHT,
      command: 'main-layout.bottom-panel.toggle',
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-activity-bar/left', {
      id: 'ide-activity-bar/left',
      component: ActivityBar,
    });
    registry.register('@ali/ide-activity-bar/right', {
      id: 'ide-activity-bar/right',
      component: ActivityBarRight,
    });
    registry.register('@ali/ide-activity-bar/bottom', {
      id: 'ide-activity-bar/bottom',
      component: ActivityBarBottom,
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
