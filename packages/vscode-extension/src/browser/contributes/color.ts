import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { ColorContribution, IThemeService } from '@ali/ide-theme';

export type ColorsSchema = Array<ColorContribution>;

@Injectable()
@Contributes('colors')
export class ThemesContributionPoint extends VscodeContributionPoint<ColorsSchema> {
  @Autowired(IThemeService)
  themeService: IThemeService;

  contribute() {
    const colors = this.json;
    // this.themeService.registerColor(colors, this.extension.path);
  }

}
