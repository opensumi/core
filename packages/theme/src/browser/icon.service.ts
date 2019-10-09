import { URI } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { ThemeType, IIconService, ThemeContribution, getThemeId, ThemeInfo, IIconTheme, getThemeType } from '../common';
import { Path } from '@ali/ide-core-common/lib/path';
import { IconThemeStore } from './icon-theme-store';
import { IconThemeData } from './icon-theme-data';

@Injectable()
export class IconService implements IIconService {
  @Autowired()
  staticResourceService: StaticResourceService;

  @Autowired()
  iconThemeStore: IconThemeStore;

  private iconThemes: Map<string, IIconTheme> = new Map();

  private iconContributionRegistry: Map<string, {contribution: ThemeContribution, basePath: string}> = new Map();

  private getPath(basePath: string, relativePath: string): URI {
    return URI.file(new Path(basePath).join(relativePath.replace(/^\.\//, '')).toString());
  }

  fromSVG(path: URI | string): string {
    if (typeof path === 'string') {
      path = URI.file(path);
    }
    const randomIconClass = `icon-${Math.random().toString(36).slice(-8)}`;
    const iconUrl = this.staticResourceService.resolveStaticResource(path).toString();
    const cssRule = `.${randomIconClass} {-webkit-mask: url(${iconUrl}) no-repeat 50% 50%;}`;
    let iconStyleNode = document.getElementById('plugin-icons');
    if (!iconStyleNode) {
      iconStyleNode = document.createElement('style');
      iconStyleNode.id = 'plugin-icons';
      document.getElementsByTagName('head')[0].appendChild(iconStyleNode);
    }
    iconStyleNode.append(cssRule);
    return randomIconClass + ' ' + 'mask-mode';
  }

  fromIcon(basePath: string, icon?: { [index in ThemeType]: string } | string): string | undefined {
    if (!icon) {
      return;
    }
    if (typeof icon === 'string') {
      return this.fromSVG(this.getPath(basePath, icon));
    }
    // TODO 监听主题变化
    return this.fromSVG(this.getPath(basePath, icon.dark));
  }

  registerIconThemes(iconContributions: ThemeContribution[], basePath: string) {
    for (const contribution of iconContributions) {
      this.iconContributionRegistry.set(getThemeId(contribution), {contribution, basePath});
    }
  }

  getAvailableThemeInfo(): ThemeInfo[] {
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

  async applyTheme(themeId: string) {
    const iconThemeData = await this.getIconTheme(themeId);
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
  }

  getVscodeIconClass(iconKey: string) {
    // TODO
    return '';
  }

}
