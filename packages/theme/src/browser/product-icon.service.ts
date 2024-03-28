import { Autowired, Injectable } from '@opensumi/di';
import {
  Deferred,
  DisposableStore,
  Emitter,
  Event,
  ExtensionDidContributes,
  GeneralSettingsId,
  IDisposable,
  ILogger,
  IPreferenceSettingsService,
  OnEvent,
  PreferenceSchemaProvider,
  PreferenceService,
  StaticResourceService,
  ThemeIcon,
  URI,
  WithEventBus,
} from '@opensumi/ide-core-browser';

import {
  DEFAULT_PRODUCT_ICON_THEME_ID,
  DEFAULT_PRODUCT_ICON_THEME_LABEL,
  ExtensionData,
  IProductIconService,
  IProductIconTheme,
  IThemeContribution,
  IconThemeInfo,
  PRODUCT_ICON_CODICON_STYLE_ID,
  PRODUCT_ICON_STYLE_ID,
  getThemeId,
} from '../common';
import { IconContribution, IconDefinition, IconFontDefinition, getIconRegistry } from '../common/icon-registry';

import { ProductIconThemeData } from './product-icon-theme-data';
import { ProductIconThemeStore } from './product-icon-theme-store';

export function asCSSUrl(uri: URI | null | undefined, staticResourceService: StaticResourceService): string {
  if (!uri) {
    return 'url("")';
  }

  function resolvePath(uri: URI) {
    if (uri.scheme === 'https') {
      return uri.toString();
    }
    // file 协议的需要走 static-resource
    return staticResourceService.resolveStaticResource(uri);
  }

  return `url('${resolvePath(uri).toString(true).replace(/'/g, '%27')}')`;
}

export function asCSSPropertyValue(value: string) {
  return `'${value.replace(/'/g, '%27')}'`;
}

@Injectable()
export class ProductIconService extends WithEventBus implements IProductIconService {
  @Autowired()
  staticResourceService: StaticResourceService;

  @Autowired()
  productIconThemeStore: ProductIconThemeStore;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(PreferenceSchemaProvider)
  private preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IPreferenceSettingsService)
  private preferenceSettings: IPreferenceSettingsService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private themeChangeEmitter: Emitter<IProductIconTheme> = new Emitter();
  public currentThemeId: string;
  public currentTheme: IProductIconTheme;
  public productIconThemeLoaded: Deferred<void> = new Deferred<void>();

  private productIconContributionRegistry: Map<string, { contribution: IThemeContribution; basePath?: URI }> =
    new Map();
  private latestApplyTheme: string;

  private getIconsStyleSheet: IIconsStyleSheet;
  readonly onDidProductIconThemeChange: Event<IProductIconTheme> = this.themeChangeEmitter.event;

  private defaultProductIconThemeData = new ProductIconThemeData(
    DEFAULT_PRODUCT_ICON_THEME_ID,
    DEFAULT_PRODUCT_ICON_THEME_LABEL,
    DEFAULT_PRODUCT_ICON_THEME_ID,
  );

  constructor() {
    super();
    this.listen();
    this.getIconsStyleSheet = getIconsStyleSheet(this, this.staticResourceService);
    this.disposables.push(this.getIconsStyleSheet);
    this.productIconContributionRegistry.set(DEFAULT_PRODUCT_ICON_THEME_ID, {
      contribution: {
        id: this.defaultProductIconThemeData.id,
        label: this.defaultProductIconThemeData.label,
        path: '',
        extensionId: this.defaultProductIconThemeData.id,
      },
    });
  }

  private listen() {
    this.preferenceService.onPreferenceChanged(async (e) => {
      if (
        e.preferenceName === GeneralSettingsId.ProductIconTheme &&
        this.productIconContributionRegistry.has(e.newValue)
      ) {
        await this.applyTheme(this.preferenceService.get<string>(GeneralSettingsId.ProductIconTheme)!);
      }
    });
  }

  @OnEvent(ExtensionDidContributes)
  async onDidExtensionContributes() {
    await this.updateProductIconThemes();
  }

  get preferenceThemeId(): string | undefined {
    return this.preferenceService.get<string>(GeneralSettingsId.ProductIconTheme);
  }

  get currentThemeData() {
    return this.currentTheme;
  }

  /**
   * 初始化注册默认主题
   */
  public async updateProductIconThemes() {
    const themeMap = this.getAvailableThemeInfos().reduce((pre: Map<string, string>, cur: IconThemeInfo) => {
      if (!pre.has(cur.themeId)) {
        pre.set(cur.themeId, cur.name);
      }
      return pre;
    }, new Map());

    this.preferenceSettings.setEnumLabels(GeneralSettingsId.ProductIconTheme, Object.fromEntries(themeMap.entries()));
    // 当前没有主题，或没有缓存的主题时，将第一个注册主题设置为当前主题
    if (!this.currentTheme) {
      if (!this.preferenceThemeId || !themeMap.has(this.preferenceThemeId)) {
        const themeId = Array.from(themeMap.keys())[0];
        if (themeId) {
          await this.applyTheme(themeId);
        }
      } else {
        await this.applyTheme(this.preferenceThemeId);
      }
    }
    this.productIconThemeLoaded.resolve();
  }

  async applyTheme(themeId: string): Promise<void> {
    if (this.currentTheme && this.currentThemeId === themeId) {
      return;
    }
    this.latestApplyTheme = themeId;

    const productIconThemeData = await this.getProductIconTheme(themeId);
    if (this.latestApplyTheme !== themeId) {
      return;
    }

    let sumiIconStyleNode = document.getElementById(PRODUCT_ICON_STYLE_ID);
    let codIconStyleNode = document.getElementById(PRODUCT_ICON_CODICON_STYLE_ID);
    this.currentThemeId = themeId;
    if (!productIconThemeData) {
      this.currentTheme = this.defaultProductIconThemeData;
    } else {
      this.currentTheme = productIconThemeData;
    }

    /**
     * product-icon-style 内存储 opensumi icon
     * codiconStyles 内存储 codicon icon
     * monaco-colors 内为 monaco 内置样式
     * 注册时序为 monaco-colors -> codiconStyles -> product-icon-style
     * TODO 此处 monaco-colors 的注册时序无法保证
     */
    const codiconStyles = this.getIconsStyleSheet.getCSS();
    const sumiiconStyles = this.getIconsStyleSheet.getSumiCSS();
    if (codIconStyleNode) {
      codIconStyleNode.innerHTML = codiconStyles || '';
    } else {
      codIconStyleNode = document.createElement('style');
      codIconStyleNode.id = PRODUCT_ICON_CODICON_STYLE_ID;
      codIconStyleNode.innerHTML = codiconStyles || '';
      document.getElementsByTagName('head')[0].appendChild(codIconStyleNode);
    }

    if (sumiIconStyleNode) {
      sumiIconStyleNode.innerHTML = sumiiconStyles || '';
    } else {
      sumiIconStyleNode = document.createElement('style');
      sumiIconStyleNode.id = PRODUCT_ICON_STYLE_ID;
      sumiIconStyleNode.innerHTML = sumiiconStyles || '';
      document.getElementsByTagName('head')[0].appendChild(sumiIconStyleNode);
    }

    this.themeChangeEmitter.fire(this.currentTheme);
    if (!this.preferenceThemeId) {
      this.productIconThemeLoaded.resolve();
    }
  }

  async getProductIconTheme(themeId: string): Promise<IProductIconTheme | undefined> {
    let theme: IProductIconTheme | undefined;
    const extContribution = this.productIconContributionRegistry.get(themeId);
    if (extContribution) {
      theme = await this.productIconThemeStore.getProductIconTheme(
        extContribution.contribution,
        extContribution.basePath,
      );
      return theme;
    }
    return;
  }

  registerProductIconThemes(productIconThemesContribution: IThemeContribution[], basePath: URI): void {
    const preferencesProductIcon = this.preferenceService.get<string>(GeneralSettingsId.ProductIconTheme);
    for (const contribution of productIconThemesContribution) {
      const themeId = getThemeId(contribution);
      this.productIconContributionRegistry.set(themeId, { contribution, basePath });
      if (preferencesProductIcon && preferencesProductIcon === themeId) {
        this.applyTheme(preferencesProductIcon);
      }
    }
    const currentSchemas = this.preferenceSchemaProvider.getPreferenceProperty(GeneralSettingsId.ProductIconTheme);
    if (currentSchemas) {
      delete currentSchemas.scope;
    }
    this.preferenceSchemaProvider.setSchema(
      {
        properties: {
          [GeneralSettingsId.ProductIconTheme]: {
            ...currentSchemas,
            enum: this.getAvailableThemeInfos().map((info) => info.themeId),
          },
        },
      },
      true,
    );

    const themeMap = this.getAvailableThemeInfos().reduce((pre: Map<string, string>, cur: IconThemeInfo) => {
      if (!pre.has(cur.themeId)) {
        pre.set(cur.themeId, cur.name);
      }
      return pre;
    }, new Map());

    this.preferenceSettings.setEnumLabels(GeneralSettingsId.ProductIconTheme, Object.fromEntries(themeMap.entries()));
    // 当前没有主题，或没有缓存的主题时，将第一个注册主题设置为当前主题
    if (!this.currentThemeId && themeMap.size <= 1) {
      if (!preferencesProductIcon || !themeMap.has(preferencesProductIcon)) {
        const themeId = Array.from(themeMap.keys())[0];
        if (themeId) {
          this.applyTheme(themeId);
        }
      }
    }
  }

  getAvailableThemeInfos(): IconThemeInfo[] {
    const themeInfos: IconThemeInfo[] = [];
    for (const { contribution } of this.productIconContributionRegistry.values()) {
      const { label, id, extensionId } = contribution;
      themeInfos.push({
        themeId: id || getThemeId(contribution),
        name: label,
        extensionId,
      });
    }
    return themeInfos;
  }
}
export interface IIconsStyleSheet extends IDisposable {
  getCSS(): string;
  readonly onDidChange: Event<void>;
  getSumiCSS(): string;
}

export function getIconsStyleSheet(
  themeService: ProductIconService | undefined,
  staticResourceService: StaticResourceService,
): IIconsStyleSheet {
  const disposable = new DisposableStore();

  const onDidChangeEmmiter = disposable.add(new Emitter<void>());
  const iconRegistry = getIconRegistry();
  disposable.add(iconRegistry.onDidChange(() => onDidChangeEmmiter.fire()));
  if (themeService) {
    disposable.add(themeService.onDidProductIconThemeChange(() => onDidChangeEmmiter.fire()));
  }

  return {
    dispose: () => disposable.dispose(),
    onDidChange: onDidChangeEmmiter.event,
    getCSS() {
      const productIconTheme = themeService ? themeService.currentThemeData : new UnthemedProductIconTheme();
      const usedFontIds: { [id: string]: IconFontDefinition } = {};
      const formatIconRule = (contribution: IconContribution): string | undefined => {
        const definition = productIconTheme.getIcon(contribution);
        if (!definition) {
          return undefined;
        }
        const fontContribution = definition.font;
        if (fontContribution) {
          usedFontIds[fontContribution.id] = fontContribution.definition as IconFontDefinition;
          return `.codicon-${contribution.id}:before { content: '${
            definition.fontCharacter
          }'; font-family: ${asCSSPropertyValue(fontContribution.id)}; }`;
        }
        return `.codicon-${contribution.id}:before { content: '${definition.fontCharacter}'; }`;
      };

      const rules: string[] = [];
      for (const contribution of iconRegistry.getIcons()) {
        const rule = formatIconRule(contribution);
        if (rule) {
          rules.push(rule);
        }
      }
      for (const id in usedFontIds) {
        if (Object.hasOwn(usedFontIds, id)) {
          const definition = usedFontIds[id];
          const fontWeight = definition.weight ? `font-weight: ${definition.weight};` : '';
          const fontStyle = definition.style ? `font-style: ${definition.style};` : '';
          const src = definition.src
            .map((l) => `${asCSSUrl(l.location, staticResourceService)} format('${l.format}')`)
            .join(', ');
          rules.push(
            `@font-face { src: ${src}; font-family: ${asCSSPropertyValue(
              id,
            )};${fontWeight}${fontStyle} font-display: block; }`,
          );
        }
      }
      return rules.join('\n');
    },
    getSumiCSS() {
      const productIconTheme = themeService ? themeService.currentThemeData : new UnthemedProductIconTheme();
      const usedFontIds: { [id: string]: IconFontDefinition } = {};
      const formatIconRule = (contribution: IconContribution): string | undefined => {
        const definition = productIconTheme.getIcon(contribution);
        if (!definition) {
          return undefined;
        }
        const fontContribution = definition.font;
        if (fontContribution) {
          usedFontIds[fontContribution.id] = fontContribution.definition as IconFontDefinition;
          // slice for 'sumi-' prefix
          return `.kticon-${contribution.id.slice(5)}:before { content: '${
            definition.fontCharacter
          }'; font-family: ${asCSSPropertyValue(fontContribution.id)}; }`;
        }
        return `.kticon-${contribution.id.slice(5)}:before { content: '${definition.fontCharacter}'; }`;
      };

      const rules: string[] = [];
      // get sumi icons
      for (const contribution of iconRegistry.getIcons(true)) {
        const rule = formatIconRule(contribution);
        if (rule) {
          rules.push(rule);
        }
      }
      for (const id in usedFontIds) {
        if (Object.hasOwn(usedFontIds, id)) {
          const definition = usedFontIds[id];
          const fontWeight = definition.weight ? `font-weight: ${definition.weight};` : '';
          const fontStyle = definition.style ? `font-style: ${definition.style};` : '';
          const src = definition.src
            .map((l) => `${asCSSUrl(l.location, staticResourceService)} format('${l.format}')`)
            .join(', ');
          rules.push(
            `@font-face { src: ${src}; font-family: ${asCSSPropertyValue(
              id,
            )};${fontWeight}${fontStyle} font-display: block; }`,
          );
        }
      }
      return rules.join('\n');
    },
  };
}

export class UnthemedProductIconTheme implements IProductIconTheme {
  id: string;
  label: string;
  extensionData?: ExtensionData | undefined;
  description?: string | undefined;
  settingsId: string | null;
  styleSheetContent?: string | undefined;
  getIcon(contribution: IconContribution) {
    const iconRegistry = getIconRegistry();
    let definition = contribution.defaults;
    while (ThemeIcon.isThemeIcon(definition)) {
      const c = iconRegistry.getIcon(definition.id);
      if (!c) {
        return undefined;
      }
      definition = c.defaults;
    }
    return definition as IconDefinition;
  }
}
