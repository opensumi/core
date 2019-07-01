import { MenuContribution, CommandContribution, CommandRegistry, MenuModelRegistry, localize, Domain } from '..';
import { COMMON_MENUS } from './common.menus';
import { FILE_COMMANDS, COMMON_COMMANDS } from './common.command';

@Domain(MenuContribution, CommandContribution)
export class ClientCommonContribution implements CommandContribution, MenuContribution {

  registerCommands(command: CommandRegistry) {
    command.registerCommand(COMMON_COMMANDS.ABOUT_COMMAND, {
      execute() {
        alert('kaitian');
      },
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerSubmenu(COMMON_MENUS.FILE, localize('file'));
    menus.registerSubmenu(COMMON_MENUS.EDIT, localize('edit'));
    menus.registerSubmenu(COMMON_MENUS.VIEW, localize('view'));
    menus.registerSubmenu(COMMON_MENUS.HELP, localize('help'));

    menus.registerMenuAction(COMMON_MENUS.FILE_NEW, {
      commandId: FILE_COMMANDS.NEW_FILE.id,
    });

    menus.registerMenuAction(COMMON_MENUS.FILE_NEW, {
      commandId: FILE_COMMANDS.NEW_FOLDER.id,
    });

    menus.registerMenuAction(COMMON_MENUS.FILE_SAVE, {
      commandId: FILE_COMMANDS.SAVE_FILE.id,
    });

    menus.registerMenuAction(COMMON_MENUS.HELP, {
      commandId: COMMON_COMMANDS.ABOUT_COMMAND.id,
    });
  }
}
