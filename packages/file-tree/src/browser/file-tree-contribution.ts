import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';

export const CONSOLE_COMMAND: Command = {
  id: 'file.tree.console',
};

@Injectable()
@Domain(CommandContribution, KeybindingContribution, MenuContribution)
export class FileTreeContribution implements CommandContribution, MenuContribution {
  @Autowired()
  logger: Logger;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CONSOLE_COMMAND, {
      execute: () => {
        // tslint:disable-next-line
        this.logger.log('file tree console..');
      },
    });
    commands.registerCommand({
      id: 'file.open',
      label: 'open file',
    }, {
      execute: (...args) => {
        console.log(args);
      },
      isEnabled: () => {
        return true;
      },
      isVisible: () => {
        return true;
      },
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(['file', 'open'], {
        commandId: 'file.open',
        order: 'a00',
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: CONSOLE_COMMAND.id,
      keybinding: 'ctrlcmd+f1',
    });
  }
}
