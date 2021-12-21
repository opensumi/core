import { Injectable, Autowired } from '@opensumi/di';
import { ThemeContribution, IIconService } from '@opensumi/ide-theme';
import { URI } from '@opensumi/ide-core-common';
import { VSCodeContributePoint, Contributes } from '../../../common';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable()
@Contributes('iconThemes')
export class IconThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IIconService)
  private readonly iconService: IIconService;

  contribute() {
    const themes = this.json.map((t) => ({
      ...t,
      label: this.getLocalizeFromNlsJSON(t.label),
    }));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.iconService.registerIconThemes(themes, URI.from(this.extension.uri!));
  }
}
