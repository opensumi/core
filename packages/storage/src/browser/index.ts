import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { DatabaseStorageContribution } from './storage.contribution';
import { IStoragePathServer, IGlobalStorageServer, IWorkspaceStorageServer } from '../common';
import { StoragePathServer } from './storage-path';
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
