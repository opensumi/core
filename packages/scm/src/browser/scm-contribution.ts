import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, SCM_COMMANDS } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';

import { SCM } from './scm.view';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, LayoutContribution)
export class SCMContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution, LayoutContribution {
  @Autowired()
  logger: Logger;

  onStart() {

  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerMenus(menus: MenuModelRegistry): void {

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
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
