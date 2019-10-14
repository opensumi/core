import { URI, PreferenceService, PreferenceSchemaProvider, IPreferenceSettingsService, Emitter, Event, getPreferenceIconThemeId } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { ThemeType, IIconService, ThemeContribution, getThemeId, ThemeInfo, IIconTheme, getThemeType, getThemeTypeSelector } from '../common';
import { Path } from '@ali/ide-core-common/lib/path';
import { IconThemeStore } from './icon-theme-store';

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

  private themeChangeEmitter: Emitter<IIconTheme> = new Emitter();

  public onThemeChange: Event<IIconTheme> = this.themeChangeEmitter.event;

  private iconThemes: Map<string, IIconTheme> = new Map();

  private iconContributionRegistry: Map<string, {contribution: ThemeContribution, basePath: string}> = new Map();

  public currentThemeId: string;
  public currentTheme: IIconTheme;

  private getPath(basePath: string, relativePath: string): URI {
    return URI.file(new Path(basePath).join(relativePath.replace(/^\.\//, '')).toString());
  }

  constructor() {
    this.listen();
  }

  listen() {
    this.preferenceService.onPreferenceChanged( (e) => {
      if (e.preferenceName === 'general.icon') {
        this.applyTheme(this.preferenceService.get<string>('general.icon')!);
      }
    });
  }

  protected appendStyleSheet(styleSheet: string) {
    let iconStyleNode = document.getElementById('plugin-icons');
    if (!iconStyleNode) {
      iconStyleNode = document.createElement('style');
      iconStyleNode.id = 'plugin-icons';
      document.getElementsByTagName('head')[0].appendChild(iconStyleNode);
    }
    iconStyleNode.append(styleSheet);
  }

  protected getRandomIconClass() {
    return `icon-${Math.random().toString(36).slice(-8)}`;
  }

  protected getStyleSheet(path: URI, className: string, baseTheme?: string): string {
    const iconUrl = this.staticResourceService.resolveStaticResource(path).toString();
    const cssRule = `${baseTheme || ''} .${className} {-webkit-mask: url(${iconUrl}) no-repeat 50% 50%;}`;
    return cssRule;
  }

  fromIcon(basePath: string, icon?: { [index in ThemeType]: string } | string): string | undefined {
    if (!icon) {
      return;
    }
    const randomClass = this.getRandomIconClass();
    if (typeof icon === 'string') {
      const targetPath = this.getPath(basePath, icon);
      this.appendStyleSheet(this.getStyleSheet(targetPath, randomClass));
    } else {
      // tslint:disable-next-line: forin
      for (const themeType in icon) {
        const themeSelector = getThemeTypeSelector(themeType as ThemeType);
        const targetPath = this.getPath(basePath, icon[themeType]);
        this.appendStyleSheet(this.getStyleSheet(targetPath, randomClass, `.${themeSelector}`));
      }
    }
    return randomClass + ' ' + 'mask-mode';
  }

  registerIconThemes(iconContributions: ThemeContribution[], basePath: string) {
    for (const contribution of iconContributions) {
      this.iconContributionRegistry.set(getThemeId(contribution), {contribution, basePath});
    }
    this.preferenceSchemaProvider.setSchema({
      properties: {
        'general.icon': {
          type: 'string',
          default: 'vscode-icons',
          enum: this.getAvailableThemeInfos().map((info) => info.themeId),
          description: '%preference.description.general.icon%',
        },
      },
    }, true);
    const map = {};
    this.getAvailableThemeInfos().forEach((info) => {
      map[info.themeId] = info.name;
    });
    this.preferenceSettings.setEnumLabels('general.icon', map);
  }

  getAvailableThemeInfos(): ThemeInfo[] {
    const themeInfos: ThemeInfo[] = [];
    for (const {contribution} of this.iconContributionRegistry.values()) {
      const {
        label,
        id,
      } = contribution;
      themeInfos.push({
        themeId: id || getThemeId(contribution),
        name: label,
      });
    }
    return themeInfos;
  }

  async getIconTheme(themeId: string): Promise<IIconTheme> {
    let theme = this.iconThemes.get(themeId);
    if (theme) {
      return theme;
    }
    const extContribution = this.iconContributionRegistry.get(themeId);
    if (extContribution) {
      theme = await this.iconThemeStore.getIconTheme(extContribution.contribution, extContribution.basePath);
      return theme;
    }
    return await this.iconThemeStore.getIconTheme();
  }

  async applyTheme(themeId?: string) {
    if (!themeId) {
      themeId = getPreferenceIconThemeId();
    }
    if (this.currentTheme && this.currentThemeId === themeId) {
      return;
    }
    this.currentThemeId = themeId;
    const iconThemeData = await this.getIconTheme(themeId);
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
    this.toggleIconVisible(true);
  }

  toggleIconVisible(show?: boolean) {
    const rootNode = document.getElementById('main')!;
    if (show === undefined) {
      rootNode.classList.toggle('show-file-icons');
    } else if (show === true) {
      rootNode.classList.add('show-file-icons');
    } else {
      rootNode.classList.remove('show-file-icons');
    }
  }

  getVscodeIconClass(iconKey: string) {
    // TODO
    return '';
  }

}
