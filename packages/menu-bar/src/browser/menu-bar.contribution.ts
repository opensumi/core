import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, IEventBus } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry, MAIN_MENU_BAR } from '@ali/ide-core-common/lib/menu';
import { localize } from '@ali/ide-core-common';
import { MenuBarService } from './menu-bar.service';
import { CommandService } from '@ali/ide-core-common';
import { ENGINE_METHOD_DIGESTS } from 'constants';
import { InitedEvent } from '@ali/ide-main-layout';
import { MainLayoutService } from '@ali/ide-main-layout/src/browser/main-layout.service';
import { SlotLocation } from '@ali/ide-main-layout';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class MenuBarContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution {

  @Autowired()
  menuBarService: MenuBarService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired()
  private layoutService!: MainLayoutService;

  @Autowired()
  logger: Logger;

  // TODO 在layout渲染之前就调用了
  onStart() {
    this.eventBus.on(InitedEvent, () => {
      this.commandService.executeCommand('main-layout.subsidiary-panel.hide');
    });
  }
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand({
      id: 'file.new',
      label: localize('menu-bar.file.new'),
    }, {
      execute: () => {
        console.log('new');
      },
    });
    commands.registerCommand({
      id: 'file.save',
      label: localize('menu-bar.file.save'),
    }, {
      execute: () => {
        this.menuBarService.saveCurrent();
      },
    });
    commands.registerCommand({
      id: 'view.outward.right-panel.hide',
    }, {
      isVisible: () => {
        return this.layoutService.isVisible(SlotLocation.right);
      },
      execute: () => {
        this.commandService.executeCommand('main-layout.subsidiary-panel.hide');
      },
    });
    commands.registerCommand({
      id: 'view.outward.right-panel.show',
    }, {
      isVisible: () => {
        return !this.layoutService.isVisible(SlotLocation.right);
      },
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
      commandId: 'file.new',
    });

    menus.registerMenuAction([...MAIN_MENU_BAR, '1file', 'save'], {
      commandId: 'file.save',
    });

    menus.registerMenuAction([...MAIN_MENU_BAR, '3view', 'outward', 'right-panel', 'hide'], {
      commandId: 'view.outward.right-panel.hide',
      label: localize('menu-bar.view.outward.right-panel.hide'),
    });

    menus.registerMenuAction([...MAIN_MENU_BAR, '3view', 'outward', 'right-panel', 'show'], {
      commandId: 'view.outward.right-panel.show',
      label: localize('menu-bar.view.outward.right-panel.show'),
    });

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
