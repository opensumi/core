import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { IExtensionManagerServer, ExtensionManagerServerPath, IExtensionManager, IExtensionManagerRequester } from '../common';
import { ExtensionManager, ExtensionManagerServer, ExtensionManagerRequester, IDEExtensionInstaller } from './extension-manager-server';
import { ExtensionManagerContribution } from './extension-manager.contribution';

@Injectable()
export class ExtensionManagerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IExtensionManagerServer,
      useClass: ExtensionManagerServer,
    },
    {
      token: IExtensionManager,
      useClass: ExtensionManager,
    },
    {
      token: IExtensionManagerRequester,
      useClass: ExtensionManagerRequester,
    },
    {
      token: IDEExtensionInstaller,
      useClass: IDEExtensionInstaller,
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
