import { Injectable, Autowired } from '@ali/common-di';
import { ThemeContribution, IThemeService } from '@ali/ide-theme';

import { VSCodeContributePoint, Contributes } from '../../../common';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable()
@Contributes('themes')
export class ThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IThemeService)
  themeService: IThemeService;

  contribute() {
    const themes = this.json;
    this.addDispose(this.themeService.registerThemes(themes, this.extension.uri!));
  }

}
