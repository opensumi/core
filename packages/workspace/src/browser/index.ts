import { Provider } from '@opensumi/di';
import { BrowserModule, Domain } from '@opensumi/ide-core-browser';

import { IWorkspaceService, IWorkspaceStorageService } from '../common';

import { WorkspaceContribution } from './workspace-contribution';
import { injectWorkspacePreferences } from './workspace-preferences';
import { WorkspaceService } from './workspace-service';
import { WorkspaceStorageService } from './workspace-storage-service';
import { WorkspaceVariableContribution } from './workspace-variable-contribution';

const pkgJson = require('../../package.json');

@Domain(pkgJson.name)
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
