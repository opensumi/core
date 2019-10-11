import { VSCodeContributePoint, Contributes } from '../../../../common';
// import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { ThemeContribution, IIconService } from '@ali/ide-theme';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable()
@Contributes('iconThemes')
export class IconThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IIconService)
  iconService: IIconService;

  contribute() {
    const icons = this.json;
    this.iconService.registerIconThemes(icons, this.extension.path);
  }

}
