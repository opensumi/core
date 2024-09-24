import { Token } from '@opensumi/di';
import { BasicModule, ConstructorOf } from '@opensumi/ide-core-common';

import { RemoteService, RemoteServiceDataStore } from './remote-service';

export function getServiceName(service: Token | ConstructorOf<RemoteService>) {
  if (typeof service === 'function') {
    return service.name;
  }
  return String(service);
}

export abstract class NodeModule extends BasicModule {
  remoteServices?: (Token | ConstructorOf<RemoteService>)[];
  remoteServiceDataStores?: ConstructorOf<RemoteServiceDataStore>[];
}
