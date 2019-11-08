import { MenuContribution, Domain, MenuModelRegistry, CommandContribution, CommandRegistry, Command, localize, QuickPickService, PreferenceService, replaceLocalizePlaceholder, PreferenceScope } from '@ali/ide-core-browser';
import { IThemeService, IIconService } from '../common';
import { Autowired } from '@ali/common-di';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

export const THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.toggle',
  label: '%theme.toggle%',
};

export const ICON_THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.icon.toggle',
  label: '%theme.icon.toggle%',
};

@Domain(NextMenuContribution, CommandContribution)
export class ThemeContribution implements NextMenuContribution, CommandContribution {

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  registerNextMenus(menus: IMenuRegistry) {
    menus.registerMenuItem(MenuId.SettingsIconMenu, {
      command: {
        id: THEME_TOGGLE_COMMAND.id,
      },
      group: '4_theme',
    });
    menus.registerMenuItem(MenuId.SettingsIconMenu, {
      command: {
        id: ICON_THEME_TOGGLE_COMMAND.id,
      },
      group: '4_theme',
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
