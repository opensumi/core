import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry, MAIN_MENU_BAR } from '@ali/ide-core-common/lib/menu';
import { localize } from '@ali/ide-core-common';
import { MenuBarService } from './menu-bar.service';
import { CommandService } from '@ali/ide-core-common';
import { FILETREE_BROWSER_COMMANDS } from '@ali/ide-file-tree/lib/browser/file-tree-contribution';
import { EDITOR_BROWSER_COMMANDS } from '@ali/ide-editor';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class MenuBarContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution {

  @Autowired()
  menuBarService: MenuBarService;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired()
  logger: Logger;

  // TODO 在layout渲染之前就调用了
  onStart() {
    setTimeout(() => {
      this.commandService.executeCommand('main-layout.subsidiary-panel.hide');
    }, 300);
  }

  registerCommands(commands: CommandRegistry): void {

  }

  registerMenus(menus: MenuModelRegistry): void {

    menus.registerSubmenu([...MAIN_MENU_BAR, '1file'], localize('menu-bar.file'));
    menus.registerSubmenu([...MAIN_MENU_BAR, '2edit'], localize('menu-bar.edit'));
    menus.registerSubmenu([...MAIN_MENU_BAR, '3view'], localize('menu-bar.view'));
    menus.registerSubmenu([...MAIN_MENU_BAR, '3view', 'outward'], localize('menu-bar.view.outward'));

    menus.registerMenuAction([...MAIN_MENU_BAR, '1file', 'new'], {
      commandId: FILETREE_BROWSER_COMMANDS.NEW_FILE.id,
      label: localize('menu-bar.file.new'),
    });

    menus.registerMenuAction([...MAIN_MENU_BAR, '1file', 'save'], {
      commandId: EDITOR_BROWSER_COMMANDS.saveCurrent,
      label: localize('menu-bar.file.save'),
    });

    menus.registerMenuAction([...MAIN_MENU_BAR, '3view', 'outward', 'right-panel', 'hide'], {
      commandId: 'view.outward.right-panel.hide',
      label: localize('menu-bar.view.outward.right-panel.hide'),
    });

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
