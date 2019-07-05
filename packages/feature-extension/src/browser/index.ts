import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, EffectDomain} from '@ali/ide-core-browser';
import { ExtensionNodeService, ExtensionNodeServiceServerPath } from '../common';
import { FeatureExtensionCapabilityRegistryImpl, FeatureExtensionManagerServiceImpl } from './extension.service';
import { FeatureExtensionCapabilityRegistry, FeatureExtensionManagerService, FeatureExtensionCapabilityContribution } from './types';
import { FeatureExtensionClientAppContribution } from './extension.contribution';
export * from './types';

@Injectable()
@EffectDomain('@ali/ide-feature-extension')
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
