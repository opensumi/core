import { Injectable, Autowired } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { ThemeContribution, IThemeService } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes } from '../../../common';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable()
@Contributes('themes')
export class ThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IThemeService)
  themeService: IThemeService;

  contribute() {
    const themes = this.json.map((t) => ({
      ...t,
      label: this.getLocalizeFromNlsJSON(t.label),
    }));
    this.addDispose(this.themeService.registerThemes(themes, URI.from(this.extension.uri!)));
  }
}
