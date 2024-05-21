import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  Command,
  CommandContribution,
  CommandRegistry,
  Domain,
  GeneralSettingsId,
  ILogger,
  Mode,
  PreferenceScope,
  PreferenceService,
  QuickOpenItem,
  QuickOpenOptions,
  QuickOpenService,
  localize,
  replaceLocalizePlaceholder,
} from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import {
  BuiltinTheme,
  BuiltinThemeComparator,
  DEFAULT_THEME_ID,
  IIconService,
  IProductIconService,
  IThemeService,
  IThemeStore,
  IconThemeInfo,
  ThemeInfo,
  getThemeTypeName,
} from '../common';
import { ISemanticTokenRegistry, ProbeScope } from '../common/semantic-tokens-registry';

import { ThemeStore } from './theme-store';

export const THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.toggle',
  label: '%theme.toggle%',
};

export const ICON_THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.icon.toggle',
  label: '%theme.icon.toggle%',
};

export const PRODUCT_ICON_THEME_TOGGLE_COMMAND: Command = {
  id: 'theme.productIcon.toggle',
  label: '%theme.productIcon.toggle%',
};

@Domain(MenuContribution, CommandContribution, ClientAppContribution)
export class ThemeContribution implements MenuContribution, CommandContribution, ClientAppContribution {
  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(IProductIconService)
  productIconService: IProductIconService;

  @Autowired(QuickOpenService)
  private quickOpenService: QuickOpenService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(ISemanticTokenRegistry)
  protected readonly semanticTokenRegistry: ISemanticTokenRegistry;

  @Autowired(IThemeStore)
  private themeStore: ThemeStore;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  async initialize() {
    this.registerDefaultColorTheme();

    this.registerDefaultTokenStyles();
    this.registerDefaultTokenType();
    this.registerDefaultTokenModifier();
    await this.themeService.colorThemeLoaded.promise;
  }

  /**
   * 如果没有设置默认 theme 或者 设置的 theme 为 dark 类型，为了有体感上的加速，设置默认的 theme
   */
  private registerDefaultColorTheme() {
    const themeId = this.preferenceService.get<string>(GeneralSettingsId.Theme);
    const shouldApplyDefaultThemeId = !themeId || themeId.includes('dark');

    if (shouldApplyDefaultThemeId) {
      this.themeService.applyTheme(this.themeStore.getDefaultThemeID());
    }

    this.themeService.ensureValidTheme().then((validTheme) => {
      this.themeService.applyTheme(validTheme);
    });
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
      this.logger.error('Failed to register token style default', e);
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
    menus.registerMenuItem(MenuId.SettingsIconMenu, {
      command: PRODUCT_ICON_THEME_TOGGLE_COMMAND.id,
      group: '4_theme',
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(THEME_TOGGLE_COMMAND, {
      execute: async (options: { extensionId?: string } = {}) => {
        const { extensionId } = options;
        const getPickItems = (extensionId?: string) => {
          const themeInfos = this.themeService.getAvailableThemeInfos();
          if (extensionId) {
            const items: {
              label: string;
              value: string;
              groupLabel?: string;
            }[] = [];
            let currentTheme: ThemeInfo | undefined;
            for (const themeInfo of themeInfos) {
              if (themeInfo.themeId === this.themeService.currentThemeId) {
                currentTheme = themeInfo;
              } else if (themeInfo.extensionId === extensionId) {
                items.push({
                  label: replaceLocalizePlaceholder(themeInfo.name)!,
                  value: themeInfo.themeId,
                });
              }
            }
            if (currentTheme) {
              items.push({
                label: replaceLocalizePlaceholder(currentTheme.name)!,
                value: currentTheme?.themeId,
                groupLabel: localize('theme.current', 'Current'),
              });
            }
            return {
              items,
              defaultSelected: 0,
            };
          }
          themeInfos.sort((a, b) => BuiltinThemeComparator[a.base] - BuiltinThemeComparator[b.base]);
          let prevBase: BuiltinTheme;
          const items = themeInfos.map((themeInfo) => {
            if (prevBase !== themeInfo.base && !prevBase?.startsWith('hc')) {
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
          return {
            items,
            defaultSelected,
          };
        };

        const { items, defaultSelected } = getPickItems(extensionId);

        const prevThemeId = this.themeService.currentThemeId;
        const themeId = await this.showPickWithPreview(
          items,
          {
            selectIndex: (lookFor) => (lookFor ? -1 : defaultSelected), // 默认展示当前主题，如果有输入，则选择第一个，否则 selectIndex 一直不变导致显示有问题
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
      execute: async (options: { extensionId?: string } = {}) => {
        const { extensionId } = options;
        const getPickItems = (extensionId?: string) => {
          const themeInfos = this.iconService.getAvailableThemeInfos();
          if (extensionId) {
            const items: {
              label: string;
              value: string;
              groupLabel?: string;
            }[] = [];

            let currentTheme: IconThemeInfo | undefined;
            for (const themeInfo of themeInfos) {
              if (themeInfo.themeId === this.iconService.currentThemeId) {
                currentTheme = themeInfo;
              } else if (themeInfo.extensionId === extensionId) {
                items.push({
                  label: themeInfo.name,
                  value: themeInfo.themeId,
                });
              }
            }
            if (currentTheme) {
              items.push({
                label: currentTheme.name,
                value: currentTheme.themeId,
                groupLabel: localize('theme.current', 'Current'),
              });
            }
            return {
              items,
              defaultSelected: 0,
            };
          }
          const items = themeInfos.map((themeInfo) => ({
            label: themeInfo.name,
            value: themeInfo.themeId,
          }));
          const defaultSelected = items.findIndex((opt) => opt.value === this.iconService.currentThemeId);
          return {
            items,
            defaultSelected,
          };
        };

        const { items, defaultSelected } = getPickItems(extensionId);
        const prevThemeId = this.iconService.currentThemeId;
        const themeId = await this.showPickWithPreview(
          items,
          {
            selectIndex: (lookFor) => (lookFor ? -1 : defaultSelected),
            placeholder: localize('theme.icon.quickopen.plh'),
          },
          (value) => {
            this.updateTopPreference(GeneralSettingsId.Icon, value);
          },
        );
        if (themeId) {
          await this.updateTopPreference(GeneralSettingsId.Icon, themeId);
        } else {
          await this.updateTopPreference(GeneralSettingsId.Icon, prevThemeId);
        }
      },
    });

    commands.registerCommand(PRODUCT_ICON_THEME_TOGGLE_COMMAND, {
      execute: async () => {
        const productIcons = this.productIconService.getAvailableThemeInfos();
        const items = productIcons.map((productIcon) => ({
          label: productIcon.name,
          value: productIcon.themeId,
        }));
        const defaultSelected = items.findIndex((opt) => opt.value === this.productIconService.currentThemeId);
        const prevThemeId = this.productIconService.currentThemeId;
        const themeId = await this.showPickWithPreview(
          items,
          {
            selectIndex: () => defaultSelected,
            placeholder: localize('theme.productIcon.quickopen.plh'),
          },
          (value) => {
            this.updateTopPreference(GeneralSettingsId.ProductIconTheme, value);
          },
        );
        if (themeId) {
          await this.updateTopPreference(GeneralSettingsId.ProductIconTheme, themeId);
        } else {
          await this.updateTopPreference(GeneralSettingsId.ProductIconTheme, prevThemeId);
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
