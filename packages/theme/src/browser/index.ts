import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { ISemanticTokenRegistry } from '../common/semantic-tokens-registry';
import { ICSSStyleService } from '../common/style';
import { ThemeServicePath, IThemeService, IIconService } from '../common/theme.service';

import { IconService } from './icon.service';
import { SemanticTokenRegistryImpl } from './semantic-tokens-registry';
import { CSSStyleService } from './style.service';
import { ThemeContribution } from './theme.contribution';
import { WorkbenchThemeService } from './workbench.theme.service';

@Injectable()
export class ThemeModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: ICSSStyleService,
      useClass: CSSStyleService,
    },
    {
      token: IThemeService,
      useClass: WorkbenchThemeService,
    },
    {
      token: IIconService,
      useClass: IconService,
    },
    {
      token: ISemanticTokenRegistry,
      useClass: SemanticTokenRegistryImpl,
    },
    ThemeContribution,
  ];

  // 依赖 fileService 服务
  backServices = [
    {
      servicePath: ThemeServicePath,
      clientToken: IThemeService,
    },
  ];
}

export * from './icon.service';
