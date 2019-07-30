import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { DatabaseStorageServerPath, IDatabaseStorageServer, IDatabaseStoragePathServer } from '../common';
import { DatabaseStorageServer } from './storage';
import { DatabaseStoragePathServer } from './storage-path';

@Injectable()
export class StorageModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IDatabaseStoragePathServer,
      useClass: DatabaseStoragePathServer,
    },
    {
      token: IDatabaseStorageServer,
      useClass: DatabaseStorageServer,
    },
  ];

  backServices = [
    {
      servicePath: DatabaseStorageServerPath,
      token: IDatabaseStorageServer,
    },
  ];
}
