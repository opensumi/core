import { Autowired } from '@opensumi/di';
import { Domain, ContributionProvider } from '@opensumi/ide-core-common';

import { ClientAppContribution } from '../common/common.define';
import { IRemoteOpenerBrowserService, RemoteOpenerBrowserServiceToken, RemoteOpenerConverterContribution } from '.';

@Domain(ClientAppContribution)
export class RemoteOpenerConverterContributionClient implements ClientAppContribution {
  @Autowired(RemoteOpenerConverterContribution)
  private readonly contributionProvider: ContributionProvider<RemoteOpenerConverterContribution>;

  @Autowired(RemoteOpenerBrowserServiceToken)
  private readonly remoteOpenerService: IRemoteOpenerBrowserService;

  onStart() {
    const contributions = this.contributionProvider.getContributions();
    for (const contribution of contributions) {
      contribution.registerConverter(this.remoteOpenerService);
    }
  }
}
