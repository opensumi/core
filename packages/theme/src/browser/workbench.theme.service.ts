import { IThemeService, ThemeServicePath, IStandaloneThemeData, ThemeMix } from '../common/theme.service';
import { Event, URI } from '@ali/ide-core-common';
import { Autowired, Injectable } from '@ali/common-di';
import { AppConfig } from '@ali/ide-core-browser';

@Injectable()
export class WorkbenchThemeService {
  @Autowired(ThemeServicePath)
  private themeService: IThemeService;

  @Autowired(AppConfig)
  private config: AppConfig;

  onCurrentThemeChange: Event<any>;

  constructor() {
    this.getTheme();
  }

  async getTheme(): Promise<ThemeMix> {
    const rootFolder = this.config.workspaceDir;
    const tmpThemePath = rootFolder.toString().replace('workspace', 'theme/solarized-dark-color-theme.json');
    const result = await this.themeService.getTheme(tmpThemePath);
    return result;
  }
}
