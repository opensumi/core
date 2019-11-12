import {
  Domain,
  localize,
  ComponentContribution,
  ComponentRegistry,
  CommandContribution,
  CommandRegistry,
  TabBarToolbarContribution,
  TabBarToolbarRegistry,
} from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { ITerminalController } from '../common';
import { terminalAdd, terminalRemove, terminalExpand, terminalClear, terminalSplit, toggleBottomPanel } from './terminal.command';
// import TerminalView from './terminal.view';
import TerminalSelect from './terminal.select';
import ResizeView from './component/resize.test';

@Domain(ComponentContribution, CommandContribution, TabBarToolbarContribution, MainLayoutContribution)
export class TerminalBrowserContribution implements ComponentContribution, CommandContribution, TabBarToolbarContribution, MainLayoutContribution {

  @Autowired(ITerminalController)
  private _terminalController: ITerminalController;

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-terminal-next', {
      component: ResizeView,
      id: 'ide-terminal-next',
    }, {
      title: localize('terminal.name'),
      priority: 10,
      activateKeyBinding: 'ctrl+`',
      containerId: 'terminal',
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(terminalAdd, {
      execute: (...args: any[]) => {
        this._terminalController.createGroup();
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });

    registry.registerCommand(terminalRemove, {
      execute: (...args: any[]) => {
        this._terminalController.removeFocus();
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });

    registry.registerCommand(terminalSplit, {
      execute: (...args: any[]) => {
        this._terminalController.split();
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });

    registry.registerCommand(terminalExpand, {
      execute: (...args: any[]) => {
        this.layoutService.expandBottom(!this.layoutService.bottomExpanded);
      },
      isEnabled: () => {
        return true;
      },
      isToggled: () => {
        if (this.layoutService.bottomExpanded) {
          return true;
        } else {
          return false;
        }
      },
    });

    registry.registerCommand(terminalClear, {
      execute: (...args: any[]) => {
        // TODO
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });

    registry.afterExecuteCommand(toggleBottomPanel.id, () => {
      console.log(111);
      if (this._terminalController.groups.length === 0) {
        this._terminalController.firstInitialize();
      }
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
    registry.registerItem({
      id: terminalExpand.id,
      command: terminalExpand.id,
      viewId: terminalExpand.category,
    });
    registry.registerItem({
      id: terminalSplit.id,
      command: terminalSplit.id,
      viewId: terminalSplit.category,
    });
    registry.registerItem({
      id: terminalRemove.id,
      command: terminalRemove.id,
      viewId: terminalRemove.category,
    });
    registry.registerItem({
      id: terminalAdd.id,
      command: terminalAdd.id,
      viewId: terminalRemove.category,
    });
  }

  onDidUseConfig() {
    const terminalTabbar = this.layoutService.getTabbarHandler('terminal');
    if (terminalTabbar) {
      terminalTabbar.setTitleComponent(TerminalSelect);
    }
  }
}
