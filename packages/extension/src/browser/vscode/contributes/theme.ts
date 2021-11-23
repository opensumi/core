import { Injectable, Autowired } from '@ide-framework/common-di';
import { ThemeContribution, IThemeService } from '@ide-framework/ide-theme';
import { URI } from '@ide-framework/ide-core-common';
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
    this.addDispose(
      this.themeService.registerThemes(themes, URI.from(this.extension.uri!)),
    );
  }
}
