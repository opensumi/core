// tslint:disable:no-console
import { CommandRegistry, CommandContribution, Domain, getIcon } from '@ali/ide-core-browser';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

class WebSCMCommands {
  static Edit = {
    id: 'web-scm.edit',
  };

  static Save = {
    id: 'web-scm.save',
  };
}

@Domain(CommandContribution, NextMenuContribution)
export class EditorTitleMenuContribution implements CommandContribution, NextMenuContribution {
  registerNextMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.EditorTitle, {
      command: {
        id: WebSCMCommands.Edit.id,
        label: '打开',
      },
      iconClass: getIcon('open'),
      group: 'navigation',
    });

    menus.registerMenuItem(MenuId.EditorTitle, {
      command: {
        id: WebSCMCommands.Save.id,
        label: '保存',
      },
      iconClass: getIcon('save-all'),
      group: 'navigation',
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(WebSCMCommands.Edit, {
      execute: async (...args) => {
        console.log(args, 'args');
      },
    });

    commands.registerCommand(WebSCMCommands.Save, {
      execute: async (...args) => {
        console.log(args, 'args');
      },
    });
  }
}
