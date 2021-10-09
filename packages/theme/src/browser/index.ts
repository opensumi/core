import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ThemeServicePath, IThemeService, IIconService } from '../common/theme.service';
import { WorkbenchThemeService } from './workbench.theme.service';
import { ICSSStyleService } from '../common/style';
import { CSSStyleService } from './style.service';
import { IconService } from './icon.service';
import { ThemeContribution } from './theme.contribution';
import { ISemanticTokenRegistry } from '../common/semantic-tokens-registry';
import { SemanticTokenRegistryImpl } from './semantic-tokens-registry';

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
  backServices = [{
    servicePath: ThemeServicePath,
    clientToken: IThemeService,
  }];

}

export * from './icon.service';
