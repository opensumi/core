import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { IStoragePathServer, IGlobalStorageServer, IWorkspaceStorageServer } from '../common';

import { StoragePathServer } from './storage-path';
import { DatabaseStorageContribution } from './storage.contribution';
import { GlobalStorageServer, WorkspaceStorageServer } from './storage.service';

@Injectable()
export class StorageModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IStoragePathServer,
      useClass: StoragePathServer,
    },
    {
      token: IGlobalStorageServer,
      useClass: GlobalStorageServer,
    },
    {
      token: IWorkspaceStorageServer,
      useClass: WorkspaceStorageServer,
    },
    DatabaseStorageContribution,
  ];
}
