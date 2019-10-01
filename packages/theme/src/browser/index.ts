import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ThemeServicePath, IThemeService, IIconTheme } from '../common/theme.service';
import { WorkbenchThemeService } from './workbench.theme.service';
import { ICSSStyleService } from '../common/style';
import { CSSStyleService } from './style.service';
import { IconService } from './icon.service';

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
      token: IIconTheme,
      useClass: IconService,
    },
  ];

  // 依赖 fileService 服务
  backServices = [{
    servicePath: ThemeServicePath,
    clientToken: WorkbenchThemeService,
  }];

}

export * from './icon.service';
