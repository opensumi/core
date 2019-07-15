import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { ColorContribution } from '@ali/ide-theme';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';

export type ColorsSchema = Array<ColorContribution>;

@Injectable()
@Contributes('colors')
export class ThemesContributionPoint extends VscodeContributionPoint<ColorsSchema> {
  @Autowired()
  themeService: WorkbenchThemeService;

  contribute() {
    const colors = this.json;
    // this.themeService.registerColor(colors, this.extension.path);
  }

}
