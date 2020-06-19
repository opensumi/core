import { Injectable, Autowired } from '@ali/common-di';
import { URI } from '@ali/ide-core-common';
import { ThemeContribution, IIconService } from '@ali/ide-theme';

import { VSCodeContributePoint, Contributes } from '../../../common';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable()
@Contributes('iconThemes')
export class IconThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IIconService)
  private readonly iconService: IIconService;

  contribute() {
    this.iconService.registerIconThemes(this.json, URI.file(this.extension.path));
  }
}
