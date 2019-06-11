import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { ActivatorBarService } from '@ali/ide-activator-bar/lib/browser/activator-bar.service';
import { StatusBarService, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';

@Injectable()
@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class BottomPanelContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution {

  @Autowired()
  private activatorBarService: ActivatorBarService;

  @Autowired()
  logger: Logger;

  @Autowired()
  statusBarService: StatusBarService;

  onStart() {
    this.statusBarService.addElement('bottom-panel-handle', {
      icon: 'window-maximize',
      text: '',
      alignment: StatusBarAlignment.RIGHT,
      command: 'main-layout.bottom-panel.toggle',
    });
  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerMenus(menus: MenuModelRegistry): void {

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
