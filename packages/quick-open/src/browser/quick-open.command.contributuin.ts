import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, Domain, MenuContribution, MenuModelRegistry, MAIN_MENU_BAR, localize } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry } from '@ali/ide-core-browser';
import { QuickCommandService } from './quick-open.command.service';

export const quickCommand: Command = {
  id: 'quickCommand',
};

@Domain(CommandContribution, KeybindingContribution, MenuContribution)
export class QuickOpenCommandContribution implements CommandContribution, KeybindingContribution, MenuContribution {
  @Autowired()
  protected readonly quickCommandService: QuickCommandService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(quickCommand, {
      execute: () => this.quickCommandService.open(),
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: quickCommand.id,
      keybinding: 'ctrlcmd+shift+p',
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction([...MAIN_MENU_BAR, '3view', 'command'], {
      commandId: quickCommand.id,
      label: localize('menu-bar.view.quick.command'),
    });
  }
}
