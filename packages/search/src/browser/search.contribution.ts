import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, CommandService } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';

const cmd: Command = {
  id: 'content-search.openSearch',
  category: 'search',
  label: 'Open search sidebar',
};

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class SearchContribution implements CommandContribution, KeybindingContribution, MenuContribution {

  @Autowired(CommandService)
  commandService: CommandService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(cmd, {
      execute: (...args: any[]) => {
        // TOOD Open search sidebar
      },
    });
  }

  registerMenus(menus: MenuModelRegistry): void {}

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: cmd.id,
      keybinding: 'ctrlcmd+shift+f',
    });
  }
}
