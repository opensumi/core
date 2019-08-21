import { VSCodeContributePoint, Contributes } from '../../../../common';
// import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { ThemeContribution, IThemeService } from '@ali/ide-theme';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable()
@Contributes('themes')
export class ThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IThemeService)
  themeService: IThemeService;

  contribute() {
    const themes = this.json;
    this.themeService.registerThemes(themes, this.extension.path);
  }

}
