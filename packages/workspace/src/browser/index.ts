import { WorkspaceServerPath, IWorkspaceStorageService, IWorkspaceServer } from '../common';
import { WorkspaceContribution } from './workspace-contribution';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain, isElectronRenderer, createElectronMainApi } from '@ali/ide-core-browser';
import { injectWorkspacePreferences } from './workspace-preferences';
import { IWorkspaceService } from '../common';
import { WorkspaceService } from './workspace-service';
import { WorkspaceStorageService } from './workspace-storage-service';
import { WorkspaceVariableContribution } from './workspace-variable-contribution';

const pkgJson = require('../../package.json');

const electronProviders = isElectronRenderer() ? [
  {
    token: WorkspaceServerPath,
    useValue: createElectronMainApi('workspace'),
  },
] : [];

@EffectDomain(pkgJson.name)
export class WorkspaceModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IWorkspaceService,
      useClass: WorkspaceService,
    },
    {
      token: IWorkspaceStorageService,
      useClass: WorkspaceStorageService,
    },
    WorkspaceContribution,
    WorkspaceVariableContribution,
    ...electronProviders,
  ];

  preferences = injectWorkspacePreferences;

  // 依赖 fileService 服务
  backServices = isElectronRenderer() ? [] : [{
    servicePath: WorkspaceServerPath,
  }];
}
