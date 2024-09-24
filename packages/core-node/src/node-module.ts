import { BasicModule, ConstructorOf } from '@opensumi/ide-core-common';

import { RemoteService, RemoteServiceDataStore } from './remote-service';

export abstract class NodeModule extends BasicModule {
  remoteServices?: ConstructorOf<RemoteService>[];
  remoteServiceDataStores?: ConstructorOf<RemoteServiceDataStore>[];
}
