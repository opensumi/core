import {
  Domain,
  localize,
  ComponentContribution,
  ComponentRegistry,
  CommandContribution,
  CommandRegistry,
  TabBarToolbarContribution,
  ToolbarRegistry,
  ClientAppContribution,
} from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { ITerminalController, ITerminalRestore } from '../common';
import { terminalAdd, terminalRemove, terminalExpand, terminalClear, terminalSplit, toggleBottomPanel } from './terminal.command';
import TerminalView from './terminal.view';
import TerminalSelect from './terminal.select';

@Domain(ComponentContribution, CommandContribution, TabBarToolbarContribution, ClientAppContribution)
export class TerminalBrowserContribution implements ComponentContribution, CommandContribution, TabBarToolbarContribution, ClientAppContribution {

  @Autowired(ITerminalController)
  terminalController: ITerminalController;

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(ITerminalRestore)
  store: ITerminalRestore;

  onReconnect() {
    this.terminalController.reconnect();
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-terminal-next', {
      component: TerminalView,
      id: 'ide-terminal-next',
    }, {
      title: localize('terminal.name'),
      priority: 1,
      activateKeyBinding: 'ctrl+`',
      containerId: 'terminal',
      titleComponent: TerminalSelect,
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(terminalAdd, {
      execute: (...args: any[]) => {
        this.terminalController.createGroup();
        this.terminalController.addWidget();
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
        this.terminalController.removeFocused();
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
        this.terminalController.addWidget();
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
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
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: terminalSplit.id,
      command: terminalSplit.id,
      viewId: terminalSplit.category,
      tooltip: localize('terminal.split'),
    });
    registry.registerItem({
      id: terminalRemove.id,
      command: terminalRemove.id,
      viewId: terminalRemove.category,
      tooltip: localize('terminal.stop'),
    });
    registry.registerItem({
      id: terminalAdd.id,
      command: terminalAdd.id,
      viewId: terminalRemove.category,
      tooltip: localize('terminal.new'),
    });
  }

  onStop() {
    this.store.save();
  }
}
