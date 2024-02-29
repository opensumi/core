import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { IThemeData } from '../common';
import { ThemeContributionProvider } from '../common/provider';
import { ISemanticTokenRegistry } from '../common/semantic-tokens-registry';
import { ICSSStyleService } from '../common/style';
import {
  IIconService,
  IProductIconService,
  IThemeService,
  IThemeStore,
  ThemeServicePath,
} from '../common/theme.service';

import { IconService } from './icon.service';
import { ProductIconService } from './product-icon.service';
import { SemanticTokenRegistryImpl } from './semantic-tokens-registry';
import { CSSStyleService } from './style.service';
import { ThemeData } from './theme-data';
import { ThemeStore } from './theme-store';
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
      token: IProductIconService,
      useClass: ProductIconService,
    },
    {
      token: ISemanticTokenRegistry,
      useClass: SemanticTokenRegistryImpl,
    },
    {
      token: IThemeData,
      useClass: ThemeData,
    },
    {
      token: IThemeStore,
      useClass: ThemeStore,
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
  contributionProvider = ThemeContributionProvider;
}

export * from './icon.service';
export * from './product-icon.service';
