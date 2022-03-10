import React from 'react';

import { Autowired } from '@opensumi/di';
import { COMMON_COMMANDS, FILE_COMMANDS, getIcon } from '@opensumi/ide-core-browser';
import { IMenuRegistry, ISubmenuItem, MenuId, MenuContribution } from '@opensumi/ide-core-browser/lib/menu/next';
import { CommandContribution, CommandRegistry, CommandService } from '@opensumi/ide-core-common';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';
import { ISCMProvider } from '@opensumi/ide-scm';

@Domain(CommandContribution, MenuContribution)
export class SelectMenuContribution implements CommandContribution, MenuContribution {
  @Autowired(CommandService)
  private readonly commandService: CommandService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      {
        id: 'gitCommitAndPush',
      },
      {
        execute: async (provider: ISCMProvider) => {
          // 强依赖了 git 插件的命令
          const mergeChanges = provider.groups.elements.filter((n) => n.id === 'merge');
          if (mergeChanges.length > 0) {
            // console.log('有冲突尚未解决，请先解决');
            return;
          }
          await this.commandService.executeCommand('git.stageAll', provider);
          await this.commandService.executeCommand('git.commit', provider);
          await this.commandService.executeCommand('git.push', provider);
        },
      },
    );
  }

  registerMenus(menuRegistry: IMenuRegistry) {
    const testSubmenuId = 'test/select/menu';
    const testSubmenuDesc = {
      submenu: testSubmenuId,
      label: '测试 select menu',
      group: 'navigation',
      order: 0,
      iconClass: getIcon('setting'),
      type: 'default',
    } as ISubmenuItem;

    menuRegistry.registerMenuItem(MenuId.EditorTitle, testSubmenuDesc);

    menuRegistry.registerMenuItem(MenuId.EditorTitle, {
      component: () => React.createElement('div', { style: { margin: '0 2px' } }, '✨'),
      order: 0,
      group: 'navigation',
    });

    // menuRegistry.registerMenuItem(MenuId.SCMTitle, testSubmenuDesc);

    menuRegistry.registerMenuItem(testSubmenuId, {
      command: FILE_COMMANDS.NEW_FILE.id,
      group: 'navigation',
      type: 'primary',
    });

    menuRegistry.registerMenuItem(testSubmenuId, {
      command: {
        id: 'editor.action.quickCommand',
        label: '打开 quick open',
      },
      group: 'navigation',
      type: 'primary',
    });

    /* ---- test for submenu ---- */
    const testSubContextMenuId = 'test/sub_context_menu_id';
    menuRegistry.registerMenuItem(MenuId.SCMResourceContext, {
      label: 'sumi submenu',
      submenu: testSubContextMenuId,
    });

    menuRegistry.registerMenuItems(testSubContextMenuId, [
      {
        command: FILE_COMMANDS.NEW_FILE.id,
        group: '1_new',
      },
    ]);

    menuRegistry.registerMenuItem(testSubContextMenuId, {
      label: 'sumi sub_submenu',
      submenu: 'sub_submenu',
    });

    menuRegistry.registerMenuItems(testSubContextMenuId, [
      {
        command: FILE_COMMANDS.NEW_FOLDER.id,
        group: '1_new',
      },
    ]);

    menuRegistry.registerMenuItem('sub_submenu', {
      command: COMMON_COMMANDS.ABOUT_COMMAND.id,
      group: '1_new',
    });

    /* ---- end for submenu ---- */
  }
}
