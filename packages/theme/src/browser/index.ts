import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ThemeServicePath } from '../common/theme.service';
import { WorkbenchThemeService } from './workbench.theme.service';
import { ThemeContribution } from './theme.contribution';
import { ICSSStyleService } from '../common/style';
import { CSSStyleService } from './style.service';

@Injectable()
export class ThemeModule extends BrowserModule {
  providers: Provider[] = [
    ThemeContribution,
    {
      token: ICSSStyleService,
      useClass: CSSStyleService,
    },
  ];

  // 依赖 fileService 服务
  backServices = [{
    servicePath: ThemeServicePath,
    clientToken: WorkbenchThemeService,
  }];

}
