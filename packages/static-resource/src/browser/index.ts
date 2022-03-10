import { Injectable, Provider, Autowired } from '@opensumi/di';
import { BrowserModule, Domain, ContributionProvider, ClientAppContribution } from '@opensumi/ide-core-browser';

import { StaticResourceService, StaticResourceContribution } from './static.definition';
import { StaticResourceServiceImpl } from './static.service';
export * from './static.definition';

@Injectable()
export class StaticResourceModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: StaticResourceService,
      useClass: StaticResourceServiceImpl,
    },
    StaticResourceClientAppContribution,
  ];

  contributionProvider = StaticResourceContribution;
}

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
