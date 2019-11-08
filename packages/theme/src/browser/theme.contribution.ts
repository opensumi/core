import { MenuContribution, Domain, MenuModelRegistry, CommandContribution, CommandRegistry, Command, localize, QuickPickService, PreferenceService, SETTINGS_MENU_PATH, replaceLocalizePlaceholder, PreferenceScope } from '@ali/ide-core-browser';
import { IThemeService, IIconService } from '../common';
import { Autowired } from '@ali/common-di';

export const THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.toggle',
  label: '%theme.toggle%',
};

export const ICON_THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.icon.toggle',
  label: '%theme.icon.toggle%',
};

@Domain(MenuContribution, CommandContribution)
export class ThemeContribution implements MenuContribution, CommandContribution {

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  registerMenus(menus: MenuModelRegistry) {
    menus.registerMenuAction([...SETTINGS_MENU_PATH, '4_theme'], {
      commandId: THEME_TOGGLE_COMMAND.id,
    });
    menus.registerMenuAction([...SETTINGS_MENU_PATH, '4_theme'], {
      commandId: ICON_THEME_TOGGLE_COMMAND.id,
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(THEME_TOGGLE_COMMAND, {
      execute: async () => {
        const themeInfos = this.themeService.getAvailableThemeInfos();
        const options = themeInfos.map((themeInfo) => ({
          label: replaceLocalizePlaceholder(themeInfo.name)!,
          value: themeInfo.themeId,
        }));
        const themeId = await this.quickPickService.show(options);
        if (themeId) {
          await this.preferenceService.set('general.theme', themeId, PreferenceScope.User);
        }
      },
    });
    commands.registerCommand(ICON_THEME_TOGGLE_COMMAND, {
      execute: async () => {
        const themeInfos = this.iconService.getAvailableThemeInfos();
        const options = themeInfos.map((themeInfo) => ({
          label: themeInfo.name,
          value: themeInfo.themeId,
          description: themeInfo.base,
        }));
        const themeId = await this.quickPickService.show(options);
        if (themeId) {
          await this.preferenceService.set('general.icon', themeId, PreferenceScope.User);
        }
      },
    });
  }
}
