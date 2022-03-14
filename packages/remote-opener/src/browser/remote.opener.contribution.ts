import { Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { AppConfig, ClientAppContribution, electronEnv } from '@opensumi/ide-core-browser';
import { ContributionProvider, Domain, getDebugLogger } from '@opensumi/ide-core-common';

import { IRemoteOpenerService, RemoteOpenerServicePath } from '../common';
import {
  IRemoteOpenerBrowserService,
  RemoteOpenerBrowserServiceToken,
  RemoteOpenerConverterContribution,
} from '../common';

// 从extension.contribution.ts中Copy过来，因为直接引入会有一定概率触发IDE初始化问题
const getClientId = (injector: Injector) => {
  let clientId: string;
  const appConfig: AppConfig = injector.get(AppConfig);

  // Electron 环境下，未指定 isRemote 时默认使用本地连接
  // 否则使用 WebSocket 连接
  if (appConfig.isElectronRenderer && !appConfig.isRemote) {
    clientId = electronEnv.metadata.windowClientId;
  } else {
    const channelHandler = injector.get(WSChannelHandler);
    clientId = channelHandler.clientId;
  }
  return clientId;
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
