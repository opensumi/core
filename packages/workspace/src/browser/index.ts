import { Provider } from '@opensumi/di';
import { BrowserModule, EffectDomain } from '@opensumi/ide-core-browser';

import { IWorkspaceStorageService } from '../common';
import { IWorkspaceService } from '../common';

import { WorkspaceContribution } from './workspace-contribution';
import { injectWorkspacePreferences } from './workspace-preferences';
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
