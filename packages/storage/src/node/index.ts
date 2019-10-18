import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { IWorkspaceStorageServer, IGlobalStorageServer, WorkspaceStorageServerPath, GlobalStorageServerPath, IStoragePathServer } from '../common';
import { WorkspaceStorageServer, GlobalStorageServer } from './storage';
import { StoragePathServer } from './storage-path';

@Injectable()
export class StorageModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IStoragePathServer,
      useClass: StoragePathServer,
    },
    {
      token: IWorkspaceStorageServer,
      useClass: WorkspaceStorageServer,
    },
    {
      token: IGlobalStorageServer,
      useClass: GlobalStorageServer,
    },
  ];

  backServices = [
    {
      servicePath: WorkspaceStorageServerPath,
      token: IWorkspaceStorageServer,
    },
    {
      servicePath: GlobalStorageServerPath,
      token: IGlobalStorageServer,
    },
  ];
}
