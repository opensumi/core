import { Injectable, Autowired } from '@ali/common-di';
import { ThemeContribution, IIconService } from '@ali/ide-theme';
import { URI } from '@ali/ide-core-common';
import { VSCodeContributePoint, Contributes } from '../../../common';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable()
@Contributes('iconThemes')
export class IconThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IIconService)
  private readonly iconService: IIconService;

  contribute() {
    this.iconService.registerIconThemes(this.json, URI.from(this.extension.uri!));
  }
}
