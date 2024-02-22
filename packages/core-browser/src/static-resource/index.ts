import { Autowired } from '@opensumi/di';
import { ContributionProvider } from '@opensumi/ide-core-common/lib/contribution-provider';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper/index';

import { ClientAppContribution } from '../common/common.define';

import { StaticResourceContribution, StaticResourceService } from './static.definition';

export * from './static.definition';

@Domain(ClientAppContribution)
export class StaticResourceClientAppContribution implements ClientAppContribution {
  @Autowired()
  private readonly staticResourceService: StaticResourceService;

  @Autowired(StaticResourceContribution)
  private readonly contributions: ContributionProvider<StaticResourceContribution>;

  initialize() {
    for (const contribution of this.contributions.getContributions()) {
      contribution.registerStaticResolver(this.staticResourceService);
    }
  }
}
