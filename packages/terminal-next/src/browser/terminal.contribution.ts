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
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';
import { ITerminalController, ITerminalRestore } from '../common';
import { terminalClear, terminalSplit, terminalSearch, terminalIndepend } from './terminal.command';
import TerminalView from './terminal.view';
import TerminalTabs from './component/tab/view';

@Domain(ComponentContribution, CommandContribution, TabBarToolbarContribution, ClientAppContribution, MainLayoutContribution)
export class TerminalBrowserContribution implements ComponentContribution, CommandContribution, TabBarToolbarContribution, ClientAppContribution, MainLayoutContribution {

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
      titleComponent: TerminalTabs,
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(terminalSearch, {
      execute: (...args: any[]) => {
        this.terminalController.openSearchInput();
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
        this.terminalController.clearCurrentWidget();
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });

    /*
    registry.registerCommand(terminalIndepend, {
      execute: (...args: any[]) => {
        // todo
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });
    */
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: terminalSearch.id,
      command: terminalSearch.id,
      viewId: terminalSearch.category,
      tooltip: localize('terminal.search'),
    });
    registry.registerItem({
      id: terminalSplit.id,
      command: terminalSplit.id,
      viewId: terminalSplit.category,
      tooltip: localize('terminal.split'),
    });
    registry.registerItem({
      id: terminalClear.id,
      command: terminalClear.id,
      viewId: terminalClear.category,
      tooltip: localize('terminal.clear'),
    });
    /*
    registry.registerItem({
      id: terminalIndepend.id,
      command: terminalIndepend.id,
      viewId: terminalIndepend.category,
      tooltip: localize('terminal.independ'),
    });
    */
  }

  onDidRender() {
    this.store.restore()
      .then(() => {
        this.terminalController.firstInitialize();
      });
  }

  onStop() {
    this.store.save();
  }
}
