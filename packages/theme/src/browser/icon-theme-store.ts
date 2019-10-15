import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IIconTheme, ThemeContribution, getThemeId } from '../common';
import { IconThemeData } from './icon-theme-data';
import { URI } from '@ali/ide-core-common';
import { Path } from '@ali/ide-core-common/lib/path';

@Injectable()
export class IconThemeStore {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private iconThemeMap: Map<string, IIconTheme> = new Map();

  async getIconTheme(contribution?: ThemeContribution, basePath?: string): Promise<IIconTheme | undefined> {
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

  protected async initIconTheme(contribution: ThemeContribution, basePath: string): Promise<IconThemeData> {
    const themeLocation = new Path(basePath).join(contribution.path.replace(/^\.\//, '')).toString();
    const iconThemeData = this.injector.get(IconThemeData);
    await iconThemeData.load(URI.file(themeLocation));
    return iconThemeData;
  }
}
