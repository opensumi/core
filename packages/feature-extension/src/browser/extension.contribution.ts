import { ClientAppContribution, ContributionProvider, Domain } from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { FeatureExtensionManagerService } from './types';

@Domain(ClientAppContribution)
export class FeatureExtensionClientAppContribution implements ClientAppContribution {

  @Autowired()
  extensionManagerService!: FeatureExtensionManagerService ;

  onStart() {
    this.extensionManagerService.activate();
  }
}
