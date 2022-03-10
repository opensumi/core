import { Autowired } from '@opensumi/di';
import {
  Domain,
  CommandContribution,
  CommandRegistry,
  Command,
  localize,
  PreferenceService,
  replaceLocalizePlaceholder,
  PreferenceScope,
  QuickOpenService,
  QuickOpenOptions,
  QuickOpenItem,
  Mode,
  ClientAppContribution,
} from '@opensumi/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import {
  IThemeService,
  IIconService,
  BuiltinThemeComparator,
  getThemeTypeName,
  BuiltinTheme,
  DEFAULT_THEME_ID,
} from '../common';
import { ISemanticTokenRegistry, ProbeScope } from '../common/semantic-tokens-registry';

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

@Domain(MenuContribution, CommandContribution, ClientAppContribution)
export class ThemeContribution implements MenuContribution, CommandContribution, ClientAppContribution {
  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(QuickOpenService)
  private quickOpenService: QuickOpenService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(ISemanticTokenRegistry)
  protected readonly semanticTokenRegistry: ISemanticTokenRegistry;

  initialize() {
    this.registerDefaultColorTheme();
    this.registerDefaultTokenStyles();
    this.registerDefaultTokenType();
    this.registerDefaultTokenModifier();
  }

  private registerDefaultColorTheme() {
    this.themeService.applyTheme(DEFAULT_THEME_ID);
  }

  private registerDefaultTokenModifier() {
    this.semanticTokenRegistry.registerTokenModifier(
      'declaration',
      localize('declaration', 'Style for all symbol declarations.'),
      undefined,
    );
    this.semanticTokenRegistry.registerTokenModifier(
      'documentation',
      localize('documentation', 'Style to use for references in documentation.'),
      undefined,
    );
    this.semanticTokenRegistry.registerTokenModifier(
      'static',
      localize('static', 'Style to use for symbols that are static.'),
      undefined,
    );
    this.semanticTokenRegistry.registerTokenModifier(
      'abstract',
      localize('abstract', 'Style to use for symbols that are abstract.'),
      undefined,
    );
    this.semanticTokenRegistry.registerTokenModifier(
      'deprecated',
      localize('deprecated', 'Style to use for symbols that are deprecated.'),
      undefined,
    );
    this.semanticTokenRegistry.registerTokenModifier(
      'modification',
      localize('modification', 'Style to use for write accesses.'),
      undefined,
    );
    this.semanticTokenRegistry.registerTokenModifier(
      'async',
      localize('async', 'Style to use for symbols that are async.'),
      undefined,
    );
    this.semanticTokenRegistry.registerTokenModifier(
      'readonly',
      localize('readonly', 'Style to use for symbols that are readonly.'),
      undefined,
    );
  }

  private registerDefaultTokenType() {
    this.doRegisterTokenType('comment', localize('comment', 'Style for comments.'), [['comment']]);
    this.doRegisterTokenType('string', localize('string', 'Style for strings.'), [['string']]);
    this.doRegisterTokenType('keyword', localize('keyword', 'Style for keywords.'), [['keyword.control']]);
    this.doRegisterTokenType('number', localize('number', 'Style for numbers.'), [['constant.numeric']]);
    this.doRegisterTokenType('regexp', localize('regexp', 'Style for expressions.'), [['constant.regexp']]);
    this.doRegisterTokenType('operator', localize('operator', 'Style for operators.'), [['keyword.operator']]);

    this.doRegisterTokenType('namespace', localize('namespace', 'Style for namespaces.'), [['entity.name.namespace']]);

    this.doRegisterTokenType('type', localize('type', 'Style for types.'), [['entity.name.type'], ['support.type']]);
    this.doRegisterTokenType('struct', localize('struct', 'Style for structs.'), [['entity.name.type.struct']]);
    this.doRegisterTokenType('class', localize('class', 'Style for classes.'), [
      ['entity.name.type.class'],
      ['support.class'],
    ]);
    this.doRegisterTokenType('interface', localize('interface', 'Style for interfaces.'), [
      ['entity.name.type.interface'],
    ]);
    this.doRegisterTokenType('enum', localize('enum', 'Style for enums.'), [['entity.name.type.enum']]);
    this.doRegisterTokenType('typeParameter', localize('typeParameter', 'Style for type parameters.'), [
      ['entity.name.type.parameter'],
    ]);

    this.doRegisterTokenType('function', localize('function', 'Style for functions'), [
      ['entity.name.function'],
      ['support.function'],
    ]);
    this.doRegisterTokenType(
      'member',
      localize('member', 'Style for member functions'),
      [],
      'method',
      'Deprecated use `method` instead',
    );
    this.doRegisterTokenType('method', localize('method', 'Style for method (member functions)'), [
      ['entity.name.function.member'],
      ['support.function'],
    ]);
    this.doRegisterTokenType('macro', localize('macro', 'Style for macros.'), [['entity.name.function.preprocessor']]);

    this.doRegisterTokenType('variable', localize('variable', 'Style for variables.'), [
      ['variable.other.readwrite'],
      ['entity.name.variable'],
    ]);
    this.doRegisterTokenType('parameter', localize('parameter', 'Style for parameters.'), [['variable.parameter']]);
    this.doRegisterTokenType('property', localize('property', 'Style for properties.'), [['variable.other.property']]);
    this.doRegisterTokenType('enumMember', localize('enumMember', 'Style for enum members.'), [
      ['variable.other.enummember'],
    ]);
    this.doRegisterTokenType('event', localize('event', 'Style for events.'), [['variable.other.event']]);

    this.doRegisterTokenType('label', localize('labels', 'Style for labels. '), undefined);
  }

  private registerDefaultTokenStyles() {
    this.doRegisterTokenStyleDefault('variable.readonly', [['variable.other.constant']]);
    this.doRegisterTokenStyleDefault('property.readonly', [['variable.other.constant.property']]);
    this.doRegisterTokenStyleDefault('type.defaultLibrary', [['support.type']]);
    this.doRegisterTokenStyleDefault('class.defaultLibrary', [['support.class']]);
    this.doRegisterTokenStyleDefault('interface.defaultLibrary', [['support.class']]);
    this.doRegisterTokenStyleDefault('variable.defaultLibrary', [['support.variable'], ['support.other.variable']]);
    this.doRegisterTokenStyleDefault('variable.defaultLibrary.readonly', [['support.constant']]);
    this.doRegisterTokenStyleDefault('property.defaultLibrary', [['support.variable.property']]);
    this.doRegisterTokenStyleDefault('property.defaultLibrary.readonly', [['support.constant.property']]);
    this.doRegisterTokenStyleDefault('function.defaultLibrary', [['support.function']]);
    this.doRegisterTokenStyleDefault('member.defaultLibrary', [['support.function']]);
  }

  private doRegisterTokenStyleDefault(selectorString: string, scopesToProbe: ProbeScope[]) {
    try {
      const selector = this.semanticTokenRegistry.parseTokenSelector(selectorString);
      this.semanticTokenRegistry.registerTokenStyleDefault(selector, { scopesToProbe });
    } catch (e) {
      // ignore error
    }
  }

  private doRegisterTokenType(
    id: string,
    description: string,
    scopesToProbe: ProbeScope[] = [],
    superType?: string,
    deprecationMessage?: string,
  ): string {
    this.semanticTokenRegistry.registerTokenType(id, description, superType, deprecationMessage);
    if (scopesToProbe) {
      this.doRegisterTokenStyleDefault(id, scopesToProbe);
    }
    return id;
  }

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
        themeInfos.sort((a, b) => BuiltinThemeComparator[a.base] - BuiltinThemeComparator[b.base]);
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
        const themeId = await this.showPickWithPreview(
          items,
          {
            selectIndex: () => defaultSelected,
            placeholder: localize('theme.quickopen.plh'),
          },
          (value) => {
            this.updateTopPreference('general.theme', value);
          },
        );

        if (themeId && themeId === this.themeService.currentThemeId) {
          return;
        }
        await this.updateTopPreference('general.theme', themeId || prevThemeId);
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
        const themeId = await this.showPickWithPreview(
          items,
          {
            selectIndex: () => defaultSelected,
            placeholder: localize('icon.quickopen.plh'),
          },
          (value) => {
            this.updateTopPreference('general.icon', value);
          },
        );
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

  protected showPickWithPreview(
    pickItems: { label: string; value: string; groupLabel?: string }[],
    options: QuickOpenOptions,
    onFocusChange: (value: string) => void,
  ) {
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
        items.push(
          new QuickOpenItem(
            Object.assign(baseOption, { groupLabel: item.groupLabel, showBorder: !!item.groupLabel && index !== 0 }),
          ),
        );
      });
      this.quickOpenService.open(
        {
          onType: (_, acceptor) => acceptor(items),
        },
        {
          onClose: () => resolve(undefined),
          fuzzyMatchLabel: true,
          showItemsWithoutHighlight: false,
          ...options,
        },
      );
    });
  }
}
