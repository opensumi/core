import { WorkspaceServerPath } from '../common';
import { WorkspaceContribution } from './workspace-contribution';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { injectWorkspacePreferences } from './workspace-preferences';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class WorkspaceModule extends BrowserModule {
  providers: Provider[] = [
    WorkspaceContribution,
  ];

  preferences = injectWorkspacePreferences;

  // 依赖 fileService 服务
  backServices = [{
    servicePath: WorkspaceServerPath,
  }];
}
