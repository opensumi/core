import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ThemeServicePath, IThemeService } from '../common/theme.service';
import { WorkbenchThemeService } from './workbench.theme.service';
import { ICSSStyleService } from '../common/style';
import { CSSStyleService } from './style.service';

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
  ];

  // 依赖 fileService 服务
  backServices = [{
    servicePath: ThemeServicePath,
    clientToken: IThemeService,
  }];

}
