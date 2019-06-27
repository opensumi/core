import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, IEventBus } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry, MAIN_MENU_BAR } from '@ali/ide-core-common/lib/menu';
import { localize } from '@ali/ide-core-common';
import { CommandService } from '@ali/ide-core-common';
import { FILETREE_BROWSER_COMMANDS } from '@ali/ide-file-tree/lib/browser';
import { EDITOR_BROWSER_COMMANDS } from '@ali/ide-editor';
import { InitedEvent } from '@ali/ide-main-layout';
import { MainLayoutService } from '@ali/ide-main-layout/src/browser/main-layout.service';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class MenuBarContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution {

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired()
  logger: Logger;

  onStart() {
    this.eventBus.on(InitedEvent, () => {
      this.commandService.executeCommand('main-layout.subsidiary-panel.hide');
    });
  }
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand({
      id: 'view.outward.right-panel.hide',
    }, {
      execute: () => {
        this.commandService.executeCommand('main-layout.subsidiary-panel.toggle');
      },
    });
    commands.registerCommand({
      id: 'view.outward.right-panel.show',
    }, {
      execute: () => {
        this.commandService.executeCommand('main-layout.subsidiary-panel.show');
      },
    });
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
      when: 'rightPanelVisible',
    });

    menus.registerMenuAction([...MAIN_MENU_BAR, '3view', 'outward', 'right-panel', 'show'], {
      commandId: 'view.outward.right-panel.show',
      label: localize('menu-bar.view.outward.right-panel.show'),
      when: '!rightPanelVisible',
    });

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
