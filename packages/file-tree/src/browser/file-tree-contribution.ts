import { Injectable } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common/lib/command';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';

export const CONSOLE_COMMAND: Command = {
  id: 'file.tree.console',
};

@Injectable()
@Domain(CommandContribution, MenuContribution)
export class FileTreeContribution implements CommandContribution, MenuContribution {
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(CONSOLE_COMMAND, {
      execute: () => {
        // tslint:disable-next-line
        console.log('file tree console..');
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
}
