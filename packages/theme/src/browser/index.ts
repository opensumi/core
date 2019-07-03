import * as React from 'react';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { ThemeServicePath } from '../common/theme.service';
import { WorkbenchThemeService } from './workbench.theme.service';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class ThemeModule extends BrowserModule {
  providers: Provider[] = [];

  // 依赖 fileService 服务
  backServices = [{
    servicePath: ThemeServicePath,
    clientToken: WorkbenchThemeService,
  }];

}
