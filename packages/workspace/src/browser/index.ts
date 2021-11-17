import { IWorkspaceStorageService } from '../common';
import { WorkspaceContribution } from './workspace-contribution';
import { Provider } from '@ide-framework/common-di';
import { BrowserModule, EffectDomain } from '@ide-framework/ide-core-browser';
import { injectWorkspacePreferences } from './workspace-preferences';
import { IWorkspaceService } from '../common';
import { WorkspaceService } from './workspace-service';
import { WorkspaceStorageService } from './workspace-storage-service';
import { WorkspaceVariableContribution } from './workspace-variable-contribution';

const pkgJson = require('../../package.json');

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
  ];

  preferences = injectWorkspacePreferences;
}
