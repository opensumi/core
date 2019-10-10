import { MenuContribution, Domain, MenuModelRegistry, CommandContribution, CommandRegistry, Command, localize, QuickPickService } from '@ali/ide-core-browser';
import { SETTINGS_MENU_PATH } from '@ali/ide-activity-bar';
import { IThemeService } from '../common';
import { Autowired } from '@ali/common-di';

export const THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.toggle',
  label: localize('theme.toggle', '切换颜色主题'),
};

@Domain(MenuContribution, CommandContribution)
export class ThemeContribution implements MenuContribution, CommandContribution {

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

  registerMenus(menus: MenuModelRegistry) {
    menus.registerMenuAction([...SETTINGS_MENU_PATH, '4_theme'], {
      commandId: THEME_TOGGLE_COMMAND.id,
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(THEME_TOGGLE_COMMAND, {
      execute: async () => {
        const themeInfos = await this.themeService.getAvailableThemeInfos();
        const options = themeInfos.map((themeInfo) => ({
          label: themeInfo.name,
          value: themeInfo.themeId,
          description: themeInfo.base,
        }));
        const themeId = await this.quickPickService.show(options);
        if (themeId) {
          this.themeService.applyTheme(themeId);
        }
      },
    });
  }
}
