import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, CommandService, IEventBus, formatLocalize, URI } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, COMMON_MENUS, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { localize } from '@ali/ide-core-common';
import { InitedEvent } from '@ali/ide-main-layout';
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

  @Autowired(IThemeService)
  private themeService: IThemeService;

  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

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
        this.commandService.executeCommand('activity-bar.right.toggle', false);
      },
    });
    commands.registerCommand({
      id: 'view.outward.right-panel.show',
    }, {
      execute: (size?: number) => {
        this.commandService.executeCommand('activity-bar.right.toggle', true, size);
      },
    });
    commands.registerCommand({
      id: 'view.outward.left-panel.hide',
    }, {
      execute: () => {
        this.commandService.executeCommand('activity-bar.left.toggle', false);
      },
    });
    commands.registerCommand({
      id: 'view.outward.left-panel.show',
    }, {
      execute: (size?: number) => {
        this.commandService.executeCommand('activity-bar.left.toggle', true, size);
      },
    });
    commands.registerCommand({
      id: 'theme.toggle',
    }, {
      execute: async () => {
        const themeInfos = await this.themeService.getAvailableThemeInfos();
        const options = themeInfos.map((themeInfo) => ({
          label: themeInfo.name,
          value: themeInfo.id,
          description: themeInfo.base,
        }));
        const themeId = await this.quickPickService.show(options);
        if (themeId) {
          this.themeService.applyTheme(themeId);
        }
      },
    });

    commands.registerCommand({
      id: 'view.localize.toggle',
    }, {
      execute: () => {
        let lang = 'zh-CN';
        // tslint:disable-next-line: no-string-literal
        const ls = global['localStorage'];
        if (ls && ls.lang) {
            lang = ls.lang;
        }
        if (lang) {
          if (lang.toLowerCase() === 'ja') {
            ls.lang = 'zh-CN';
          } else {
            ls.lang = 'ja';
          }
          location.reload();
        }
      },
    });

    commands.registerCommand({
      id: 'file.pref',
    }, {
      execute: () => {
        this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI('pref://global'));
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

    menus.registerMenuAction(COMMON_MENUS.VIEW_THEME, {
      commandId: 'theme.toggle',
      label: localize('menu-bar.view.outward.theme.toggle'),
    });

    menus.registerMenuAction(COMMON_MENUS.VIEW_LOCALIZE, {
      commandId: 'view.localize.toggle',
      label: localize('menu-bar.view.outward.localize.toggle'),
    });

    menus.registerMenuAction(COMMON_MENUS.FILE_PREF, {
      commandId: 'file.pref',
      label: localize('menu-bar.file.pref'),
    });

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
