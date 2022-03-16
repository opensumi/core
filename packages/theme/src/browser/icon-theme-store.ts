import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';

import { IIconTheme, ThemeContribution, getThemeId } from '../common';

import { IconThemeData } from './icon-theme-data';

@Injectable()
export class IconThemeStore {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private iconThemeMap: Map<string, IIconTheme> = new Map();

  async getIconTheme(contribution?: ThemeContribution, basePath?: URI): Promise<IIconTheme | undefined> {
    if (!contribution || !basePath) {
      return;
    }
    const id = getThemeId(contribution);
    const cachedTheme = this.iconThemeMap.get(id);
    if (cachedTheme) {
      return cachedTheme;
    }
    const iconTheme = await this.initIconTheme(contribution, basePath);
    this.iconThemeMap.set(id, iconTheme);
    return iconTheme;
  }

  protected async initIconTheme(contribution: ThemeContribution, basePath: URI): Promise<IconThemeData> {
    const contributedPath = contribution.path.replace(/^\.\//, '');
    // http 的不作支持
    const themeLocation = basePath.resolve(contributedPath);

    const iconThemeData = this.injector.get(IconThemeData);
    await iconThemeData.load(themeLocation);
    return iconThemeData;
  }
}
