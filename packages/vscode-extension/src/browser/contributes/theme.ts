import { VscodeContributionPoint } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { ThemeContribution } from '@ali/ide-theme';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';

export type ThemesSchema = Array<ThemeContribution>;

@Injectable({multiple: true})
export class ThemesContributionPoint extends VscodeContributionPoint<ThemesSchema> {
  @Autowired()
  themeService: WorkbenchThemeService;

  contribute() {
    this.json.forEach((theme) => {
      console.log(theme);
      // this.themeService.registerTheme(theme);
    });
  }

}
