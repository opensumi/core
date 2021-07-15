import { Domain, CommandContribution, CommandRegistry, Command, localize, PreferenceService, replaceLocalizePlaceholder, PreferenceScope, QuickOpenService, QuickOpenOptions, QuickOpenItem, Mode } from '@ali/ide-core-browser';
import { IThemeService, IIconService, BuiltinThemeComparator, getThemeTypeName, BuiltinTheme } from '../common';
import { Autowired } from '@ali/common-di';
import { MenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

export const THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.toggle',
  label: '%theme.toggle%',
  alias: 'Color Theme',
};

export const ICON_THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.icon.toggle',
  label: '%theme.icon.toggle%',
  alias: 'File Icon Theme',
};

@Domain(MenuContribution, CommandContribution)
export class ThemeContribution implements MenuContribution, CommandContribution {

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(QuickOpenService)
  private quickOpenService: QuickOpenService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  registerMenus(menus: IMenuRegistry) {
    menus.registerMenuItem(MenuId.SettingsIconMenu, {
      command: THEME_TOGGLE_COMMAND.id,
      group: '4_theme',
    });
    menus.registerMenuItem(MenuId.SettingsIconMenu, {
      command: ICON_THEME_TOGGLE_COMMAND.id,
      group: '4_theme',
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(THEME_TOGGLE_COMMAND, {
      execute: async () => {
        const themeInfos = this.themeService.getAvailableThemeInfos();
        themeInfos.sort((a, b) => {
          return BuiltinThemeComparator[a.base] - BuiltinThemeComparator[b.base];
        });
        let prevBase: BuiltinTheme;
        const items = themeInfos.map((themeInfo) => {
          if (prevBase !== themeInfo.base) {
            prevBase = themeInfo.base;
            return {
              label: replaceLocalizePlaceholder(themeInfo.name)!,
              value: themeInfo.themeId,
              groupLabel: localize(getThemeTypeName(prevBase)),
            };
          }
          return {
            label: replaceLocalizePlaceholder(themeInfo.name)!,
            value: themeInfo.themeId,
          };
        });
        const defaultSelected = items.findIndex((opt) => opt.value === this.themeService.currentThemeId);
        const prevThemeId = this.themeService.currentThemeId;
        const themeId = await this.showPickWithPreview(items, {
          selectIndex: () => defaultSelected,
          placeholder: localize('theme.quickopen.plh'),
        }, (value) => {
          this.updateTopPreference('general.theme', value);
        });
        if (themeId) {
          await this.updateTopPreference('general.theme', themeId);
        } else {
          await this.updateTopPreference('general.theme', prevThemeId);
        }
      },
    });
    commands.registerCommand(ICON_THEME_TOGGLE_COMMAND, {
      execute: async () => {
        const themeInfos = this.iconService.getAvailableThemeInfos();
        const items = themeInfos.map((themeInfo) => ({
          label: themeInfo.name,
          value: themeInfo.themeId,
        }));
        const defaultSelected = items.findIndex((opt) => opt.value === this.iconService.currentThemeId);
        const prevThemeId = this.iconService.currentThemeId;
        const themeId = await this.showPickWithPreview(items, {
          selectIndex: () => defaultSelected,
          placeholder: localize('icon.quickopen.plh'),
        }, (value) => {
          this.updateTopPreference('general.icon', value);
        });
        if (themeId) {
          await this.updateTopPreference('general.icon', themeId);
        } else {
          await this.updateTopPreference('general.icon', prevThemeId);
        }
      },
    });
  }

  protected async updateTopPreference(key: string, value: string) {
    const effectiveScope = this.preferenceService.resolve(key).scope;
    // 最小就更新 User 的值
    if (typeof effectiveScope === 'undefined' || effectiveScope <= PreferenceScope.User) {
      await this.preferenceService.set(key, value, PreferenceScope.User);
    } else {
      await this.preferenceService.set(key, value, effectiveScope);
    }
  }

  protected showPickWithPreview(pickItems: { label: string; value: string, groupLabel?: string }[], options: QuickOpenOptions, onFocusChange: (value: string) => void) {
    return new Promise((resolve: (value: string | undefined) => void) => {
      const items: QuickOpenItem[] = [];
      pickItems.forEach((item, index) => {
        const baseOption = {
          label: item.label,
          run: (mode: Mode) => {
            if (mode === Mode.PREVIEW) {
              onFocusChange(item.value);
              return true;
            }
            if (mode === Mode.OPEN) {
              resolve(item.value);
              return true;
            }
            return false;
          },
        };
        items.push(new QuickOpenItem(Object.assign(baseOption, { groupLabel: item.groupLabel, showBorder: !!item.groupLabel && index !== 0 })));
      });
      this.quickOpenService.open({
        onType: (_, acceptor) => acceptor(items),
      }, {
        onClose: () => resolve(undefined),
        fuzzyMatchLabel: true,
        showItemsWithoutHighlight: false,
        ...options,
      });
    });
  }
}
