import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { URI } from '@opensumi/ide-core-common';
import { ThemeContribution, IThemeService } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable()
@Contributes('themes')
@LifeCycle(LifeCyclePhase.Initialize)
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
