
import { Autowired } from '@ali/common-di';
import { ILogger, Domain, COMMON_MENUS, localize, CommandContribution, CommandRegistry } from '@ali/ide-core-browser';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { QuickPickService } from '@ali/ide-quick-open/lib/browser/quick-open.model';
import { WorkbenchThemeService } from './workbench.theme.service';

@Domain(MenuContribution, CommandContribution)
export class ThemeContribution implements MenuContribution, CommandContribution {

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

  @Autowired()
  private themeService: WorkbenchThemeService;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({
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

  registerMenus(registry: MenuModelRegistry) {
    registry.registerMenuAction(COMMON_MENUS.VIEW_THEME, {
      commandId: 'theme.change',
      label: localize('theme.change', '切换主题'),
    });
  }
}
