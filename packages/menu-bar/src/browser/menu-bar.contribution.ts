import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, CommandService, IEventBus } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, COMMON_MENUS } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { localize } from '@ali/ide-core-common';
import { InitedEvent } from '@ali/ide-main-layout';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { QuickPickService } from '@ali/ide-quick-open/lib/browser/quick-open.model';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class MenuBarContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution {

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired()
  private themeService: WorkbenchThemeService;

  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

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
    commands.registerCommand({
      id: 'theme.change',
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

    menus.registerMenuAction(COMMON_MENUS.VIEW_THEME, {
      commandId: 'theme.change',
      label: localize('theme.change', '切换主题'),
    });

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
