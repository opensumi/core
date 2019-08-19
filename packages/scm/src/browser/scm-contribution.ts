import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, CommandService } from '@ali/ide-core-common';
import {
  KeybindingContribution, KeybindingRegistry, Logger,
  ClientAppContribution, SCM_COMMANDS, IContextKeyService,
} from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';

import { SCM } from './scm.view';
import { ISCMService, SCMService } from '../common';

export const SCM_ACCEPT_INPUT: Command = {
  id: 'scm.acceptInput',
};

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, LayoutContribution)
export class SCMContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution, LayoutContribution {
  @Autowired()
  protected readonly logger: Logger;

  @Autowired(IContextKeyService)
  protected readonly contextService: IContextKeyService;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(SCMService)
  protected readonly scmService: SCMService;

  onStart() {

  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(SCM_ACCEPT_INPUT, {
      execute: async () => {
        const [selectedRepository] = this.scmService.selectedRepositories;
        if (!selectedRepository || !selectedRepository.provider.acceptInputCommand) {
          return;
        }

        const { id: commandId, arguments: args = [] } = selectedRepository.provider.acceptInputCommand;
        if (!commandId) {
          return;
        }

        this.commandService.executeCommand(commandId, ...args);
      },
    });
  }

  registerMenus(menus: MenuModelRegistry): void {

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: SCM_ACCEPT_INPUT.id,
      keybinding: 'ctrlcmd+enter',
      // when: // todo
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-scm', {
      component: SCM,
      iconClass: 'volans_icon git_icon',
      initialProps: {
        test: 'from props',
      },
    });
  }
}
