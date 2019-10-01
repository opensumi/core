import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IIconTheme, ThemeContribution, getThemeId } from '../common';
import { IconThemeData } from './icon-theme-data';
import { URI } from '@ali/ide-core-common';

@Injectable()
export class IconThemeStore {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private iconThemeMap: Map<string, { iconThemeData: IconThemeData }> = new Map();

  async getIconTheme(contribution: ThemeContribution) {
    const id = getThemeId(contribution);
    if (this.iconThemeMap.get(id)) {
      return this.iconThemeMap.get(id);
    } else {
      const iconTheme = await this.initIconTheme(contribution);
      this.iconThemeMap.set(id, {iconThemeData: iconTheme});
    }
  }

  protected async initIconTheme(contribution: ThemeContribution): Promise<IconThemeData> {
    const iconThemeData = this.injector.get(IconThemeData, [URI.file(contribution.path)]);
    await iconThemeData.load();
    return iconThemeData;
  }
}
