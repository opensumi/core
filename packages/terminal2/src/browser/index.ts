import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, Domain} from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { TerminalView, InputView } from './terminal.view';
import { TerminalClient } from './terminal.client';
import { ITerminalServicePath, ITerminalClient } from '../common';

export const terminalAdd: Command = {
  id: 'terminal.add',
  label: 'add terminal',
  iconClass: 'fa fa-plus',
  category: 'terminal',
};

export const terminalRemove: Command = {
  id: 'terminal.remove',
  label: 'remove terminal',
  iconClass: 'fa fa-trash-o',
  category: 'terminal',
};

export const terminalExpand: Command = {
  id: 'terminal.expand',
  label: 'expand terminal',
  iconClass: 'fa fa-chevron-up',
  category: 'terminal',
};

@Injectable()
export class Terminal2Module extends BrowserModule {
  providers: Provider[] = [
    TerminalContribution,
    {
      token: ITerminalClient,
      useClass: TerminalClient,
    },
  ];

  backServices = [
    {
      servicePath: ITerminalServicePath,
      clientToken: ITerminalClient,
    },
  ];

}

@Domain(ComponentContribution, TabBarToolbarContribution, MainLayoutContribution, CommandContribution)
export class TerminalContribution implements ComponentContribution, TabBarToolbarContribution, MainLayoutContribution {

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(ITerminalClient)
  terminalClient: ITerminalClient;

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
      title: '终端',
      weight: 10,
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

  onDidUseConfig() {
    const handler = this.layoutService.getTabbarHandler('terminal');
    if (handler) {
      handler.setTitleComponent(InputView);
    }
  }
}
