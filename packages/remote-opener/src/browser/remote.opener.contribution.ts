import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import { ContributionProvider, Domain, IApplicationService, getDebugLogger } from '@opensumi/ide-core-common';

import {
  IRemoteOpenerBrowserService,
  IRemoteOpenerService,
  RemoteOpenerBrowserServiceToken,
  RemoteOpenerConverterContribution,
  RemoteOpenerServicePath,
} from '../common';

// 从extension.contribution.ts中Copy过来，因为直接引入会有一定概率触发IDE初始化问题
const getClientId = (injector: Injector) => {
  const service: IApplicationService = injector.get(IApplicationService);
  return service.clientId;
};

@Domain(ClientAppContribution)
export class RemoteOpenerContributionClient implements ClientAppContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(RemoteOpenerServicePath)
  private readonly remoteOpenerNodeService: IRemoteOpenerService;

  @Autowired(RemoteOpenerConverterContribution)
  private readonly contributionProvider: ContributionProvider<RemoteOpenerConverterContribution>;

  @Autowired(RemoteOpenerBrowserServiceToken)
  private readonly remoteOpenerService: IRemoteOpenerBrowserService;

  private readonly debug = getDebugLogger();

  onStart() {
    const contributions = this.contributionProvider.getContributions();
    for (const contribution of contributions) {
      contribution.registerConverter(this.remoteOpenerService);
    }
  }

  onStop() {
    try {
      const clientId = getClientId(this.injector);
      this.remoteOpenerNodeService.removeConnectionClientId(clientId);
    } catch (e) {
      this.debug.error(e);
    }
  }
}
