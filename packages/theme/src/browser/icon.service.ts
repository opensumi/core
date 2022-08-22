import { Injectable, Autowired } from '@opensumi/di';
import {
  URI,
  PreferenceService,
  PreferenceSchemaProvider,
  IPreferenceSettingsService,
  Emitter,
  Event,
  ILogger,
  CODICON_OWNER,
  path,
  Deferred,
  OnEvent,
  WithEventBus,
  ExtensionDidContributes,
  Schemes,
  GeneralSettingsId,
} from '@opensumi/ide-core-browser';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';

import {
  ThemeType,
  IIconService,
  ThemeContribution,
  getThemeId,
  IIconTheme,
  getThemeTypeSelector,
  IconType,
  IconShape,
  IconThemeInfo,
} from '../common';

import { IconThemeStore } from './icon-theme-store';

import './icon.less';

const { Path } = path;

@Injectable()
export class IconService extends WithEventBus implements IIconService {
  @Autowired()
  staticResourceService: StaticResourceService;

  @Autowired()
  iconThemeStore: IconThemeStore;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(PreferenceSchemaProvider)
  private preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IPreferenceSettingsService)
  private preferenceSettings: IPreferenceSettingsService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  iconThemeLoaded: Deferred<void> = new Deferred<void>();

  private themeChangeEmitter: Emitter<IIconTheme> = new Emitter();

  public onThemeChange: Event<IIconTheme> = this.themeChangeEmitter.event;

  private iconThemes: Map<string, IIconTheme> = new Map();

  private iconContributionRegistry: Map<string, { contribution: ThemeContribution; basePath: URI }> = new Map();

  public currentThemeId: string;
  public currentTheme: IIconTheme;
  private latestApplyTheme: string;

  private iconMap: Map<string, string> = new Map();

  // eg. $(codicon/sync~spin)
  private _regexFromString = /^\$\(([a-z.]+\/)?([a-z-]+)(~[a-z]+)?\)$/i;

  private getPath(basePath: string, relativePath: string): URI {
    if (relativePath.startsWith('./')) {
      const uri = new URI(basePath).resolve(relativePath.replace(/^\.\//, ''));
      return uri.scheme ? uri : URI.file(uri.toString());
    } else if (/^http(s)?/.test(relativePath)) {
      return new URI(relativePath);
    } else if (basePath) {
      const uri = new URI(basePath).resolve(relativePath);
      return uri.scheme ? uri : URI.file(uri.toString());
    } else if (/^file:\/\//.test(relativePath)) {
      return new URI(relativePath);
    } else {
      return URI.file(relativePath);
    }
  }

  constructor() {
    super();
    this.listen();
  }

  private listen() {
    this.preferenceService.onPreferenceChanged(async (e) => {
      if (e.preferenceName === GeneralSettingsId.Icon && this.iconContributionRegistry.has(e.newValue)) {
        await this.applyTheme(this.preferenceService.get<string>(GeneralSettingsId.Icon)!);
      }
    });
  }

  private styleSheetCollection = '';

  private appendStylesTimer: number | undefined;
  private appendStyleCounter = 0;

  private doAppend(targetElement: HTMLElement | null) {
    if (targetElement) {
      const textContent = targetElement?.textContent + this.styleSheetCollection;
      targetElement.textContent = textContent;
    }

    this.styleSheetCollection = '';
    this.appendStylesTimer = undefined;
    this.appendStyleCounter = 0;
    clearTimeout(this.appendStylesTimer);
  }

  protected appendStyleSheet(styleSheet: string, fromExtension = false) {
    let iconStyleNode = document.getElementById('plugin-icons');
    if (!iconStyleNode) {
      iconStyleNode = document.createElement('style');
      iconStyleNode.id = 'plugin-icons';
      document.getElementsByTagName('head')[0].appendChild(iconStyleNode);
    }

    // 非插件进程注册的 icon 正常 append
    if (!fromExtension) {
      iconStyleNode.append(styleSheet);
      return;
    }

    // 针对插件进程注册的 icon 进行 append 分段处理
    // 避免因为过多 icon 导致页面卡顿
    // 例如 GitLens 插件会注册超过 800 个 icon
    this.styleSheetCollection += '\r\n' + styleSheet;
    this.appendStyleCounter += 1;

    // 超过 100 个样式
    if (this.appendStyleCounter >= 150 && this.appendStylesTimer) {
      clearTimeout(this.appendStylesTimer);
      this.appendExtensionIconStyle();
    }

    if (!this.appendStylesTimer) {
      // 超过 100 毫秒
      this.appendStylesTimer = window.setTimeout(() => {
        this.appendExtensionIconStyle();
      }, 100);
    }
  }

  private appendExtensionIconStyle(styleNode?: HTMLElement | null) {
    if (styleNode) {
      this.doAppend(styleNode);
    } else {
      const randomClass = this.getRandomIconClass('extension-');
      const styleNode = document.createElement('style');
      styleNode!.className = randomClass;
      this.doAppend(styleNode);
      document.getElementsByTagName('head')[0].appendChild(styleNode);
    }
  }

  protected getRandomIconClass(prefix = '') {
    return `${prefix}icon-${Math.random().toString(36).slice(-8)}`;
  }

  protected getMaskStyleSheet(iconUrl: string, className: string, baseTheme?: string): string {
    const cssRule = `${baseTheme || ''} .${className} {-webkit-mask: url("${iconUrl}") no-repeat 50% 50%;}`;
    return cssRule;
  }

  protected getMaskStyleSheetWithStaticService(path: URI, className: string, baseTheme?: string): string {
    const iconUrl = this.staticResourceService.resolveStaticResource(path).toString();
    return this.getMaskStyleSheet(iconUrl, className, baseTheme);
  }

  protected getBackgroundStyleSheet(iconUrl: string, className: string, baseTheme?: string): string {
    const cssRule = `${
      baseTheme || ''
    } .${className} {background: url("${iconUrl}") no-repeat 0 0;background-size:cover;}`;
    return cssRule;
  }

  protected getBackgroundStyleSheetWithStaticService(path: URI, className: string, baseTheme?: string): string {
    const iconUrl = this.staticResourceService.resolveStaticResource(path).toString();
    return this.getBackgroundStyleSheet(iconUrl, className, baseTheme);
  }

  fromString(str: string): string | undefined {
    if (typeof str !== 'string') {
      return undefined;
    }
    const matched = str.match(this._regexFromString);
    if (!matched) {
      return undefined;
    }
    const [, owner, name, modifier] = matched;
    const iconOwner = owner ? owner.slice(0, -1) : CODICON_OWNER;
    let className = `${iconOwner} ${iconOwner}-${name}`;
    if (modifier) {
      className += ` ${modifier.slice(1)}`;
    }
    return className;
  }

  fromIcon(
    basePath = '',
    icon?: { [index in ThemeType]: string } | string,
    type: IconType = IconType.Mask,
    shape: IconShape = IconShape.Square,
    fromExtension = false,
  ): string | undefined {
    if (!icon) {
      return;
    }
    const iconPath = typeof icon === 'string' ? icon : icon.dark;
    const iconId = `${basePath}-${iconPath}-${type}-${shape}`;
    if (this.iconMap.get(iconId)) {
      return this.iconMap.get(iconId);
    }
    const randomClass = this.getRandomIconClass();
    if (typeof icon === 'string') {
      /**
       * 处理 data:image 格式，/^data:image\//
       * 如 data:image/svg+xml or data:image/gif;base64,
       * 此时无需 static service
       */
      if (type === IconType.Base64) {
        this.appendStyleSheet(this.getBackgroundStyleSheet(icon, randomClass), fromExtension);
      } else {
        const targetPath = this.getPath(basePath, icon);
        if (type === IconType.Mask) {
          this.appendStyleSheet(this.getMaskStyleSheetWithStaticService(targetPath, randomClass), fromExtension);
        } else {
          this.appendStyleSheet(this.getBackgroundStyleSheetWithStaticService(targetPath, randomClass), fromExtension);
        }
      }
    } else {
      // eslint-disable-next-line guard-for-in
      for (const themeType in icon) {
        const themeSelector = getThemeTypeSelector(themeType as ThemeType);
        const targetPath = this.getPath(basePath, icon[themeType]);
        if (type === IconType.Mask) {
          this.appendStyleSheet(
            this.getMaskStyleSheetWithStaticService(targetPath, randomClass, `.${themeSelector}`),
            fromExtension,
          );
        } else {
          this.appendStyleSheet(
            this.getBackgroundStyleSheetWithStaticService(targetPath, randomClass, `.${themeSelector}`),
            fromExtension,
          );
        }
      }
    }
    const targetIconClass = [
      'kaitian-icon',
      randomClass,
      {
        [IconType.Background]: 'background-mode',
        [IconType.Base64]: 'background-mode',
        [IconType.Mask]: 'mask-mode',
      }[type],
      shape === IconShape.Circle ? 'circle' : '',
    ].join(' ');
    this.iconMap.set(iconId, targetIconClass);
    return targetIconClass;
  }

  @OnEvent(ExtensionDidContributes)
  async onDidExtensionContributes() {
    await this.updateIconThemes();
    this.iconThemeLoaded.resolve();
  }

  get preferenceThemeId(): string | undefined {
    return this.preferenceService.get<string>(GeneralSettingsId.Icon);
  }

  private async updateIconThemes() {
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

  registerIconThemes(iconContributions: ThemeContribution[], basePath: URI) {
    for (const contribution of iconContributions) {
      const themeId = getThemeId(contribution);
      this.iconContributionRegistry.set(themeId, { contribution, basePath });
      if (this.preferenceThemeId && this.preferenceThemeId === themeId) {
        this.applyTheme(this.preferenceThemeId);
      }
    }

    const currentSchemas = this.preferenceSchemaProvider.getPreferenceProperty(GeneralSettingsId.Icon);
    if (currentSchemas) {
      delete currentSchemas.scope;
    }
    this.preferenceSchemaProvider.setSchema(
      {
        properties: {
          [GeneralSettingsId.Icon]: {
            ...currentSchemas,
            enum: this.getAvailableThemeInfos().map((info) => info.themeId),
          },
        },
      },
      true,
    );

    this.updateIconThemes();
  }

  getAvailableThemeInfos(): IconThemeInfo[] {
    const themeInfos: IconThemeInfo[] = [];
    for (const { contribution } of this.iconContributionRegistry.values()) {
      const { label, id } = contribution;
      themeInfos.push({
        themeId: id || getThemeId(contribution),
        name: label,
      });
    }
    return themeInfos;
  }

  async getIconTheme(themeId: string): Promise<IIconTheme | undefined> {
    let theme = this.iconThemes.get(themeId);
    if (theme) {
      return theme;
    }
    const extContribution = this.iconContributionRegistry.get(themeId);
    if (extContribution) {
      theme = await this.iconThemeStore.getIconTheme(extContribution.contribution, extContribution.basePath);
      return theme;
    }
    return;
  }

  async applyTheme(themeId: string) {
    this.toggleIconVisible(true);
    if (this.currentTheme && this.currentThemeId === themeId) {
      return;
    }
    /**
     * 这里 `applyTheme` 默认应该按照最后一个应用的主题进行加载
     * 但由于 `getIconTheme` 存在时序问题，例如：
     * 主题 A，E，分别由插件 A，E 贡献
     * 这里先调用 applyTheme(E), 再调用 applyTheme(A)
     * 旧的逻辑由于插件 A ... E 的加载顺序问题，会存在 A 比 E 快加载的情况导致最终应用了错误的主题
     *
     * 故这里增加额外判断，保障最后一个加载的主题应用
     */
    this.latestApplyTheme = themeId;
    const iconThemeData = await this.getIconTheme(themeId);
    if (this.latestApplyTheme !== themeId) {
      return;
    }
    if (!iconThemeData) {
      this.logger.warn('Target IconTheme extension not detected, use built-in icons.');
      document.getElementsByTagName('body')[0].classList.add('default-file-icons');
      this.iconThemeLoaded.resolve();
      return;
    }
    this.currentThemeId = themeId;
    document.getElementsByTagName('body')[0].classList.remove('default-file-icons');
    this.currentTheme = iconThemeData;
    const { styleSheetContent } = iconThemeData;
    let styleNode = document.getElementById('icon-style');
    if (styleNode) {
      styleNode.innerHTML = styleSheetContent;
    } else {
      styleNode = document.createElement('style');
      styleNode.id = 'icon-style';
      styleNode.innerHTML = styleSheetContent;
      document.getElementsByTagName('head')[0].appendChild(styleNode);
    }
    this.themeChangeEmitter.fire(this.currentTheme);

    if (!this.preferenceThemeId) {
      this.iconThemeLoaded.resolve();
    }
  }

  toggleIconVisible(show?: boolean) {
    const rootNode = document.getElementsByTagName('body')[0]!;
    if (show === undefined) {
      rootNode.classList.toggle('show-file-icons');
    } else if (show === true) {
      rootNode.classList.add('show-file-icons');
    } else {
      rootNode.classList.remove('show-file-icons');
    }
  }
}
