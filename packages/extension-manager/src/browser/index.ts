import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ExtensionManagerContribution } from './extension-manager.contribution';
import { IExtensionManagerService, ExtensionManagerServerPath } from '../common';
import { ExtensionManagerService } from './extension-manager.service';

@Injectable()
export class ExtensionManagerModule extends BrowserModule {
  providers: Provider[] = [
    ExtensionManagerContribution,
    {
      token: IExtensionManagerService,
      useClass: ExtensionManagerService,
    },
  ];

  backServices = [
    {
      servicePath: ExtensionManagerServerPath,
    },
  ];
}
