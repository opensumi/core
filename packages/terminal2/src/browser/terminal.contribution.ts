import { Autowired } from '@ali/common-di';
import { Domain, CommandService, localize, KeybindingContribution, KeybindingRegistry, ClientAppContribution, IContextKeyService } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@ali/ide-core-browser/lib/layout';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { HIDE_BOTTOM_PANEL_COMMAND } from '@ali/ide-main-layout/lib/browser/main-layout.contribution';
import { CommandContribution, CommandRegistry } from '@ali/ide-core-common';
import { TerminalView, TerminalToolbarView } from './terminal.view';
import { ITerminalClient } from '../common';
import { getIcon, ROTATE_TYPE } from '@ali/ide-core-browser/lib/icon';
import { Command } from '@ali/ide-core-common';

export const terminalAdd: Command = {
  id: 'terminal.add',
  label: 'add terminal',
  iconClass: getIcon('plus'),
  category: 'terminal',
};

export const terminalRemove: Command = {
  id: 'terminal.remove',
  label: 'remove terminal',
  iconClass: getIcon('delete'),
  category: 'terminal',
};

export const terminalExpand: Command = {
  id: 'terminal.expand',
  label: 'expand terminal',
  iconClass: getIcon('up'),
  toogleIconClass: getIcon('up', ROTATE_TYPE.rotate_180),
  category: 'terminal',
};

export const terminalClear: Command = {
  id: 'terminal.clear',
  label: 'clear terminal',
  iconClass: getIcon('clear'),
  category: 'terminal',
};

@Domain(ComponentContribution, KeybindingContribution, TabBarToolbarContribution, MainLayoutContribution, CommandContribution, ClientAppContribution)
export class TerminalContribution implements ComponentContribution, KeybindingContribution, TabBarToolbarContribution, MainLayoutContribution, ClientAppContribution {

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(ITerminalClient)
  terminalClient: ITerminalClient;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(terminalAdd, {
      execute: (...args: any[]) => {
        this.terminalClient.createTerminal();
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });
    commands.registerCommand(terminalRemove, {
      execute: (...args: any[]) => {
        this.terminalClient.removeTerm();
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });
    commands.registerCommand(terminalExpand, {
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
    commands.registerCommand(terminalClear, {
      execute: (...args: any[]) => {
        const currentTerminal = this.terminalClient.getTerminal(this.terminalClient.activeId);
        if (currentTerminal) {
          currentTerminal.clear();
        }
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-terminal2', {
      component: TerminalView,
      id: 'ide-terminal2',
    }, {
      title: localize('terminal.name'),
      priority: 10,
      activateKeyBinding: 'ctrl+`',
      containerId: 'terminal',
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
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
    registry.registerItem({
      id: terminalExpand.id,
      command: terminalExpand.id,
      viewId: terminalExpand.category,
    });
  }

  registerKeybindings(registry: KeybindingRegistry) {
    registry.registerKeybinding({
      command: terminalClear.id,
      keybinding: 'cmd+k',
      context: 'terminalFocus',
    });
  }

  onDidUseConfig() {
    const handler = this.layoutService.getTabbarHandler('terminal');

    if (handler) {
      handler.onActivate(() => {
        if (this.terminalClient.termMap.size < 1) {
          this.terminalClient.createTerminal();
        }
      });
      handler.setTitleComponent(TerminalToolbarView);

      this.terminalClient.onDidCloseTerminal(() => {
        if (this.terminalClient.termMap.size < 1) {
          this.commandService.executeCommand(HIDE_BOTTOM_PANEL_COMMAND.id);
        }
      });
    }
  }
  async onStart() {

    // todo terminal-focus contextkey
    // const terminalFocus = this.contextKeyService.createKey<boolean>('terminalFocus', false);

  }
}
