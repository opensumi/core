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
  KeybindingRegistry,
  KeybindingContribution,
  TERMINAL_COMMANDS,
  URI,
} from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';
import { ITerminalController, ITerminalRestore } from '../common';
import { terminalClear, terminalSplit, terminalSearch, terminalSearchNext } from './terminal.command';
import TerminalView from './terminal.view';
import TerminalTabs from './component/tab/view';
import { IsTerminalFocused } from '@ali/ide-core-browser/lib/contextkey';

@Domain(ComponentContribution, CommandContribution, TabBarToolbarContribution, ClientAppContribution, MainLayoutContribution, KeybindingContribution)
export class TerminalBrowserContribution implements ComponentContribution, CommandContribution, TabBarToolbarContribution, ClientAppContribution, MainLayoutContribution, KeybindingContribution {

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
    });

    registry.registerCommand(terminalSplit, {
      execute: (...args: any[]) => {
        const id = this.terminalController.addWidget();
        this.terminalController.focus();
        this.terminalController.focusWidget(id);
      },
    });

    registry.registerCommand(terminalClear, {
      execute: (...args: any[]) => {
        this.terminalController.clearCurrentWidget();
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.OPEN_WITH_PATH, {
      execute: (uri: URI) => {
        // TODO:实现在terminal中打开对应路径
      },
    });

    registry.registerCommand(terminalSearchNext, {
      execute: (...args: any[]) => {
        if (this.terminalController.searchState.show) {
          this.terminalController.search();
        } else {
          this.terminalController.openSearchInput();
        }
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

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: terminalClear.id,
      keybinding: 'ctrlcmd+k',
      when: IsTerminalFocused.raw,
    });
    keybindings.registerKeybinding({
      command: terminalSearchNext.id,
      keybinding: 'ctrlcmd+g',
      when: IsTerminalFocused.raw,
    });
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
