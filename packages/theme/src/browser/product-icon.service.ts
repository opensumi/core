import { Injectable, Autowired } from '@opensumi/di';
import {
  URI,
  PreferenceService,
  PreferenceSchemaProvider,
  IPreferenceSettingsService,
  Emitter,
  Event,
  ILogger,
  GeneralSettingsId,
  WithEventBus,
  ExtensionDidContributes,
  OnEvent,
  Deferred,
  DisposableStore,
  ThemeIcon,
  IDisposable,
} from '@opensumi/ide-core-browser';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';

import {
  IProductIconService,
  IProductIconTheme,
  ThemeContribution,
  getThemeId,
  IconThemeInfo,
  ExtensionData,
} from '../common';
import { IconContribution, IconDefinition, IconFontDefinition, getIconRegistry } from '../common/icon-registry';

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
  public onThemeChange: Event<IProductIconTheme> = this.themeChangeEmitter.event;
  public currentThemeId: string;
  public currentTheme: IProductIconTheme;
  private productIconThemes: Map<string, IProductIconTheme> = new Map();
  productIconThemeLoaded: Deferred<void> = new Deferred<void>();

  private productIconContributionRegistry: Map<string, { contribution: ThemeContribution; basePath: URI }> = new Map();
  private latestApplyTheme: string;

  private iconThemes: Map<string, IProductIconTheme> = new Map();
  private iconMap: Map<string, string> = new Map();
  private getIconsStyleSheet: IIconsStyleSheet;
  readonly onDidProductIconThemeChange: Event<IProductIconTheme> = this.themeChangeEmitter.event;

  constructor() {
    super();
    this.listen();
    this.getIconsStyleSheet = getIconsStyleSheet(this, this.staticResourceService);
    this.getIconsStyleSheet.onDidChange(() => {
      // this.iconMap = new Map();
      // this.iconThemes = new Map();
      // this.iconContributionRegistry = new Map();
      // this.getIconsStyleSheet.getCSS().split('\n').forEach((line) => {
      //   const match = line.match(/\.codicon-(\w+):before/);
      //   if (match) {
      //     const codicon = match[1];
      //     const icon = line.match(/content: "(.*)"/)?.[1];
      //     if (icon) {
      //       this.iconMap.set(codicon, icon);
      //     }
      //   }
      // });
      // this.getIconsStyleSheet.getIconTheme().forEach((theme) => {
      //   this.iconThemes.set(theme.themeId, theme);
      //   this.iconContributionRegistry.set(theme.themeId, {
      //     contribution: theme,
      //     basePath: URI.file(theme.path),
      //   });
      // });
    });
    this.disposables.push(this.getIconsStyleSheet);
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
    this.productIconThemeLoaded.resolve();
  }

  get preferenceThemeId(): string | undefined {
    return this.preferenceService.get<string>(GeneralSettingsId.ProductIconTheme);
  }

  get currentThemeData() {
    return this.currentTheme;
  }

  private async updateProductIconThemes() {
    const themeMap = this.getAvailableThemeInfos().reduce((pre: Map<string, string>, cur: IconThemeInfo) => {
      if (!pre.has(cur.themeId)) {
        pre.set(cur.themeId, cur.name);
      }
      return pre;
    }, new Map());

    this.preferenceSettings.setEnumLabels(GeneralSettingsId.Icon, Object.fromEntries(themeMap.entries()));
    // 当前没有主题，或没有缓存的主题时，将第一个注册主题设置为当前主题
    if (!this.currentTheme) {
      if (!this.preferenceThemeId || !themeMap.has(this.preferenceThemeId)) {
        const themeId = Array.from(themeMap.keys())[0];
        if (themeId) {
          await this.applyTheme(themeId);
        }
      }
    }
  }

  async applyTheme(themeId: string): Promise<void> {
    this.toggleIconVisible(true);
    if (this.currentTheme && this.currentThemeId === themeId) {
      return;
    }
    this.latestApplyTheme = themeId;

    const productIconThemeData = await this.getProductIconTheme(themeId);
    if (!productIconThemeData) {
      this.logger.warn('Target ProductIconTheme extension not detected, use built-in icons.');
      document.getElementsByTagName('body')[0].classList.add('default-product-icons');
      this.productIconThemeLoaded.resolve();
      return;
    }
    this.currentThemeId = themeId;
    document.getElementsByTagName('body')[0].classList.remove('default-product-icons');
    this.currentTheme = productIconThemeData;

    // styleSheetContent 内仅存储 opensumi icon
    // vscode icon 为 codicon 由 monaoc-colors 样式表承载
    // 由于 两者加载时机无法判断 所以内容需区分开

    const codiconStyles = this.getIconsStyleSheet.getCSS();
    const sumiiconStyles = this.getIconsStyleSheet.getSumiCSS();

    let styleNode = document.getElementById('product-icon-style');
    let monacoNode = document.getElementById('codiconStyles');
    // let monacoNode = document.getElementsByClassName('monaco-colors')[0];

    // TODO monaco patch monaco-colors cannot remove
    if (monacoNode) {
      monacoNode.innerHTML = codiconStyles || '';
    } else {
      monacoNode = document.createElement('style');
      monacoNode.id = 'codiconStyles';
      monacoNode.innerHTML = codiconStyles || '';
      document.getElementsByTagName('head')[0].appendChild(monacoNode);
    }

    if (styleNode) {
      styleNode.innerHTML = sumiiconStyles || '';
    } else {
      styleNode = document.createElement('style');
      styleNode.id = 'product-icon-style';
      styleNode.innerHTML = sumiiconStyles || '';
      document.getElementsByTagName('head')[0].appendChild(styleNode);
    }

    this.themeChangeEmitter.fire(this.currentTheme);
    if (!this.preferenceThemeId) {
      this.productIconThemeLoaded.resolve();
    }
  }

  async getProductIconTheme(themeId: string): Promise<IProductIconTheme | undefined> {
    let theme = this.productIconThemes.get(themeId);
    if (theme) {
      return theme;
    }
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

  registerProductIconThemes(productIconThemesContribution: ThemeContribution[], basePath: URI): void {
    const preferencesProductIcon = this.preferenceService.get<string>(GeneralSettingsId.ProductIconTheme);
    for (const contribution of productIconThemesContribution) {
      const themeId = getThemeId(contribution);
      this.productIconContributionRegistry.set(themeId, { contribution, basePath });
      if (preferencesProductIcon && preferencesProductIcon === themeId) {
        this.applyTheme(preferencesProductIcon);
      }
    }
    this.preferenceSchemaProvider.setSchema(
      {
        properties: {
          [GeneralSettingsId.ProductIconTheme]: {
            type: 'string',
            // TODO default icon
            default: 'vscode-icons',
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

  toggleIconVisible(show?: boolean) {
    const rootNode = document.getElementsByTagName('body')[0]!;
    if (show === undefined) {
      rootNode.classList.toggle('show-product-icons');
    } else if (show === true) {
      rootNode.classList.add('show-product-icons');
    } else {
      rootNode.classList.remove('show-product-icons');
    }
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
          return `.kticon-${contribution.id}:before { content: '${
            definition.fontCharacter
          }'; font-family: ${asCSSPropertyValue(fontContribution.id)}; }`;
        }
        return `.kticon-${contribution.id}:before { content: '${definition.fontCharacter}'; }`;
      };

      const rules: string[] = [];
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
