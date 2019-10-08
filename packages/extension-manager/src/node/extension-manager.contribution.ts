import { ServerAppContribution, Domain, IServerApp, AppConfig, INodeLogger } from '@ali/ide-core-node';
import * as fs from 'fs-extra';
import { Autowired } from '@ali/common-di';

@Domain(ServerAppContribution)
export class ExtensionManagerContribution implements ServerAppContribution {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INodeLogger)
  logger: INodeLogger;

  async initialize() {
    if (!this.appConfig.marketplace.accountId || !this.appConfig.marketplace.masterKey) {
      throw new Error('masterplace accountId and masterKey is required');
    }
    // 初始化插件目录
    await fs.mkdirp(this.appConfig.marketplace.extensionDir);
    this.logger.log('marketplace extension dir is', this.appConfig.marketplace.extensionDir);
  }
}
