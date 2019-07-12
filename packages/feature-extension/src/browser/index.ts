import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule} from '@ali/ide-core-browser';
import { ExtensionNodeService, ExtensionNodeServiceServerPath } from '../common';
import { FeatureExtensionCapabilityRegistryImpl, FeatureExtensionManagerServiceImpl } from './extension.service';
import { FeatureExtensionCapabilityRegistry, FeatureExtensionManagerService, FeatureExtensionCapabilityContribution } from './types';
import { FeatureExtensionClientAppContribution } from './extension.contribution';
export * from './types';

@Injectable()
export class FeatureExtensionModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: FeatureExtensionCapabilityRegistry,
      useClass: FeatureExtensionCapabilityRegistryImpl,
    },
    {
      token: FeatureExtensionManagerService,
      useClass: FeatureExtensionManagerServiceImpl,
    },
    FeatureExtensionClientAppContribution,
  ];

  contributionProvider = FeatureExtensionCapabilityContribution;

  backServices = [{
    servicePath: ExtensionNodeServiceServerPath,
    clientToken: FeatureExtensionCapabilityRegistryImpl,
  }];

}
