import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { URI } from '@opensumi/ide-core-common';
import { ThemeContribution, IIconService } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable()
@Contributes('iconThemes')
@LifeCycle(LifeCyclePhase.Initialize)
export class IconThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IIconService)
  protected readonly iconService: IIconService;

  contribute() {
    const themes = this.json.map((t) => ({
      ...t,
      label: this.getLocalizeFromNlsJSON(t.label),
    }));
    this.iconService.registerIconThemes(themes, URI.from(this.extension.uri!));
  }
}
