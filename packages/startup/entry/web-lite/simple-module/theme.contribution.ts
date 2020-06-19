import { Injectable, Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common';
import { ClientAppContribution, URI } from '@ali/ide-core-browser';
import { IIconService, IThemeService, ThemeContribution } from '@ali/ide-theme';

import { themeDefaultExtContributes } from '../ide-exts/ide-theme';
import { themeSetiExtContributes } from '../ide-exts/seti-theme';

@Injectable()
@Domain(ClientAppContribution)
export class ThemeAndIconContribution implements ClientAppContribution {
  @Autowired(IThemeService)
  private readonly themeService: IThemeService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  async initialize() {
    this.themeService.registerThemes(themeDefaultExtContributes.pkgJSON.contributes.themes as ThemeContribution[], URI.parse(themeDefaultExtContributes.extPath));
    for (const themeExt of [ themeDefaultExtContributes, themeSetiExtContributes ]) {
      this.iconService.registerIconThemes(themeExt.pkgJSON.contributes.iconThemes, URI.parse(themeExt.extPath));
    }

    await this.themeService.applyTheme('Default Dark+');
    await this.iconService.applyTheme('vs-seti');
  }
}
