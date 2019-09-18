import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { IExtensionManagerServer, ExtensionManagerServerPath } from '../common';
import { ExtensionManagerServer } from './extension-manager-server';
import { ExtensionManagerContribution } from './extension-manager.contribution';

@Injectable()
export class ExtensionManagerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IExtensionManagerServer,
      useClass: ExtensionManagerServer,
    },
    ExtensionManagerContribution,
  ];
  backServices = [
    {
      servicePath: ExtensionManagerServerPath,
      token: IExtensionManagerServer,
    },
  ];
}
