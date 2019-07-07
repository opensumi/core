import { WorkspaceServerPath } from '../common';
import { WorkspaceService } from './workspace-service';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { injectWorkspacePreferences } from './workspace-preferences';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class WorkspaceModule extends BrowserModule {
  providers: Provider[] = [];

  preferences = injectWorkspacePreferences;

  // 依赖 fileService 服务
  backServices = [{
    servicePath: WorkspaceServerPath,
    clientToken: WorkspaceService,
  }];
}

export * from './workspace-preferences';
export * from './workspace-service';
