import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { Terminal } from './terminal.view';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';

@Domain(CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution)
export class TerminalContribution implements CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution {

  @Autowired()
  logger: Logger;

  registerCommands(commands: CommandRegistry): void {
  }

  registerMenus(menus: MenuModelRegistry): void {

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-terminal', {
      component: Terminal,
      id: 'ide-terminal',
    }, {
      title: '终端',
    });
  }
}
