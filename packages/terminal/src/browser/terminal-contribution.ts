import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { BottomPanelService } from '@ali/ide-bottom-panel/lib/browser/bottom-panel.service';
import { Terminal } from './terminal.view';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class TerminalContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution {

  @Autowired()
  private bottomPanelService: BottomPanelService;

  @Autowired()
  logger: Logger;

  onStart() {
    // this.bottomPanelService.append({title: '终端', component: Terminal});
  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerMenus(menus: MenuModelRegistry): void {

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
