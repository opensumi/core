
import { Autowired } from '@ali/common-di';
import { ClientAppContribution, ILogger, ContributionProvider, Domain } from '@ali/ide-core-browser';
import { MonacoService, MonacoContribution } from '../common';

@Domain(ClientAppContribution)
export class MonacoClientContribution implements ClientAppContribution {

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired()
  monacoService: MonacoService;

  @Autowired(MonacoContribution)
  contributionProvider: ContributionProvider<MonacoContribution>;

  async initialize() {
    await this.monacoService.loadMonaco();
    for (const contribution of this.contributionProvider.getContributions()) {
      contribution.onMonacoLoaded(this.monacoService);
    }
  }
}
