import { Domain } from '@ali/ide-core-node';
import { ClientAppContribution } from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { WorkbenchThemeService } from './workbench.theme.service';

@Domain(ClientAppContribution)
export class ThemeContribution implements ClientAppContribution {
  @Autowired()
  themeService: WorkbenchThemeService;

  async onStart() {
    // await this.themeService.initRegistedThemes();
    // await this.themeService.applyTheme();
    // console.log('ThemeContribution done');
  }
}
