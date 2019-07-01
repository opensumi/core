import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, CommandService, IEventBus } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, COMMON_MENUS } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { localize } from '@ali/ide-core-common';
import { InitedEvent } from '@ali/ide-main-layout';

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

    menus.registerMenuAction(COMMON_MENUS.VIEW_VIEWS, {
      commandId: 'view.outward.right-panel.hide',
      label: localize('menu-bar.view.outward.right-panel.hide'),
      when: 'rightPanelVisible',
    });

    menus.registerMenuAction(COMMON_MENUS.VIEW_VIEWS, {
      commandId: 'view.outward.right-panel.show',
      label: localize('menu-bar.view.outward.right-panel.show'),
      when: '!rightPanelVisible',
    });

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
