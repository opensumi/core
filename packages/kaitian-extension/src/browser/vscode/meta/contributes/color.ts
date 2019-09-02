// import { VscodeContributionPoint, Contributes } from './common';
import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { ExtColorContribution, IThemeService } from '@ali/ide-theme';
import { replaceLocalizePlaceholder } from '@ali/ide-core-browser';

export type ColorsSchema = Array<ExtColorContribution>;

@Injectable()
@Contributes('colors')
export class ColorsContributionPoint extends VSCodeContributePoint<ColorsSchema> {
  @Autowired(IThemeService)
  themeService: IThemeService;

  contribute() {
    const colors = this.json;
    for (const color of colors) {
      if (color && color.description) {
        color.description = replaceLocalizePlaceholder(color.description) as string;
      }
      this.themeService.registerColor(color);
    }
  }

}
