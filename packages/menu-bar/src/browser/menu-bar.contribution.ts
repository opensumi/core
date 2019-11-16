import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, CommandService, IEventBus, formatLocalize, URI } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, COMMON_MENUS, EDITOR_COMMANDS, IClientApp } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { localize } from '@ali/ide-core-common';
import { QuickPickService } from '@ali/ide-quick-open/lib/browser/quick-open.model';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { MenuBar } from './menu-bar.view';
import { IThemeService } from '@ali/ide-theme';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution)
export class MenuBarContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution, ComponentContribution {

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired(IClientApp)
  clientApp: IClientApp;

  @Autowired()
  logger: Logger;

  onStart() {
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-menu-bar', {
      id: 'ide-menu-bar',
      component: MenuBar,
    }, {
      size: 27,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand({
      id: 'view.outward.right-panel.hide',
    }, {
      execute: () => {
        this.commandService.executeCommand('main-layout.right-panel.toggle', false);
      },
    });
    commands.registerCommand({
      id: 'view.outward.right-panel.show',
    }, {
      execute: (size?: number) => {
        this.commandService.executeCommand('main-layout.right-panel.toggle', true, size);
      },
    });
    commands.registerCommand({
      id: 'view.outward.left-panel.hide',
    }, {
      execute: () => {
        this.commandService.executeCommand('main-layout.left-panel.toggle', false);
      },
    });
    commands.registerCommand({
      id: 'view.outward.left-panel.show',
    }, {
      execute: (size?: number) => {
        this.commandService.executeCommand('main-layout.left-panel.toggle', true, size);
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

    menus.registerMenuAction(COMMON_MENUS.VIEW_VIEWS, {
      commandId: 'view.outward.left-panel.hide',
      label: localize('menu-bar.view.outward.left-panel.hide'),
      when: 'leftPanelVisible',
    });

    menus.registerMenuAction(COMMON_MENUS.VIEW_VIEWS, {
      commandId: 'view.outward.left-panel.show',
      label: localize('menu-bar.view.outward.left-panel.show'),
      when: '!leftPanelVisible',
    });

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
