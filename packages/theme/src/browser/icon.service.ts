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
  runWhenIdle,
} from '@opensumi/ide-core-browser';
import { Path } from '@opensumi/ide-core-common/lib/path';
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

export const ICON_THEME_SETTING = 'general.icon';

@Injectable()
export class IconService implements IIconService {
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

  private themeChangeEmitter: Emitter<IIconTheme> = new Emitter();

  public onThemeChange: Event<IIconTheme> = this.themeChangeEmitter.event;

  private iconThemes: Map<string, IIconTheme> = new Map();

  private iconContributionRegistry: Map<string, { contribution: ThemeContribution; basePath: URI }> = new Map();

  public currentThemeId: string;
  public currentTheme: IIconTheme;

  private iconMap: Map<string, string> = new Map();

  // eg. $(codicon/sync~spin)
  private _regexFromString = /^\$\(([a-z.]+\/)?([a-z-]+)(~[a-z]+)?\)$/i;

  private getPath(basePath: string, relativePath: string): URI {
    if (relativePath.startsWith('./')) {
      return URI.file(new Path(basePath).join(relativePath.replace(/^\.\//, '')).toString());
    } else if (/^http(s)?/.test(relativePath)) {
      return new URI(relativePath);
    } else if (basePath) {
      return URI.file(new Path(basePath).join(relativePath).toString());
    } else if (/^file:\/\//.test(relativePath)) {
      return new URI(relativePath);
    } else {
      return URI.file(relativePath);
    }
  }

  constructor() {
    this.listen();
  }

  private listen() {
    this.preferenceService.onPreferenceChanged(async (e) => {
      if (e.preferenceName === ICON_THEME_SETTING) {
        await this.applyTheme(this.preferenceService.get<string>(ICON_THEME_SETTING)!);
      }
    });
  }

  private styleSheetCollection = '';

  private appendStylesTimer: number | undefined;
  private appendStyleCounter = 0;

  private doAppend(targetElement: HTMLElement | null) {
    targetElement?.append(this.styleSheetCollection);
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
      this.doAppend(iconStyleNode);
    }

    if (!this.appendStylesTimer) {
      // 超过 100 毫秒
      this.appendStylesTimer = window.setTimeout(() => {
        this.doAppend(iconStyleNode);
      }, 100);
    }
  }

  protected getRandomIconClass() {
    return `icon-${Math.random().toString(36).slice(-8)}`;
  }

  protected getMaskStyleSheet(iconUrl: string, className: string, baseTheme?: string): string {
    const cssRule = `${baseTheme || ''} .${className} {-webkit-mask: url("${iconUrl}") no-repeat 50% 50% / 24px;}`;
    return cssRule;
  }

  protected getMaskStyleSheetWithStaticService(path: URI, className: string, baseTheme?: string): string {
    const iconUrl =
      path.scheme === 'file' ? this.staticResourceService.resolveStaticResource(path).toString() : path.toString();
    return this.getMaskStyleSheet(iconUrl, className, baseTheme);
  }

  protected getBackgroundStyleSheet(iconUrl: string, className: string, baseTheme?: string): string {
    const cssRule = `${
      baseTheme || ''
    } .${className} {background: url("${iconUrl}") no-repeat 50% 50%;background-size:contain;}`;
    return cssRule;
  }

  protected getBackgroundStyleSheetWithStaticService(path: URI, className: string, baseTheme?: string): string {
    const iconUrl =
      path.scheme === 'file' ? this.staticResourceService.resolveStaticResource(path).toString() : path.toString();
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

  registerIconThemes(iconContributions: ThemeContribution[], basePath: URI) {
    const preferencesIcon = this.preferenceService.get<string>(ICON_THEME_SETTING);
    for (const contribution of iconContributions) {
      const themeId = getThemeId(contribution);
      this.iconContributionRegistry.set(themeId, { contribution, basePath });
      if (preferencesIcon && preferencesIcon === themeId) {
        this.applyTheme(preferencesIcon);
      }
    }
    this.preferenceSchemaProvider.setSchema(
      {
        properties: {
          [ICON_THEME_SETTING]: {
            type: 'string',
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

    this.preferenceSettings.setEnumLabels(ICON_THEME_SETTING, Object.fromEntries(themeMap.entries()));
    // 当前没有主题，或没有缓存的主题时，将第一个注册主题设置为当前主题
    if (!this.currentTheme && themeMap.size <= 1) {
      if (!preferencesIcon || !themeMap.has(preferencesIcon)) {
        const themeId = Array.from(themeMap.keys())[0];
        if (themeId) {
          this.applyTheme(themeId);
        }
      }
    }
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
    const iconThemeData = await this.getIconTheme(themeId);
    if (!iconThemeData) {
      this.logger.warn('没有检测到目标图标主题插件，使用内置图标！');
      document.getElementsByTagName('body')[0].classList.add('default-file-icons');
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
