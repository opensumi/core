import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { ExtColorContribution } from '@ali/ide-theme';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';

export type ColorsSchema = Array<ExtColorContribution>;

@Injectable()
@Contributes('colors')
export class ColorsContributionPoint extends VscodeContributionPoint<ColorsSchema> {
  @Autowired()
  themeService: WorkbenchThemeService;

  contribute() {
    const colors = this.json;
    for (const color of colors) {
      this.themeService.registerColor(color);
    }
  }

}
