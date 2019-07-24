import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { IExtensionStorageServer, IExtensionStoragePathServer, ExtensionStorageServerPath } from '../common';
import { ExtensionStorageServer } from './storage';
import { ExtensionStoragePathServer } from './storage-path';
@Injectable()
export class ExtensionStorageModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IExtensionStorageServer,
      useClass: ExtensionStorageServer,
    },
    {
      token: IExtensionStoragePathServer,
      useClass: ExtensionStoragePathServer,
    },
  ];

  backServices = [
    {
      servicePath: ExtensionStorageServerPath,
      token: IExtensionStorageServer,
    },
  ];
}
