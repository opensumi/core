import { Injectable, Provider, Autowired } from '@ali/common-di';
import { BrowserModule, createContributionProvider, Domain, ContributionProvider, ClientAppContribution } from '@ali/ide-core-browser';
import { StaticResourceService, StaticResourceContribution, StaticResourceContributionProvider } from './static.definition';
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
  staticResourceService: StaticResourceService;

  @Autowired(StaticResourceContribution)
  private readonly contributions: ContributionProvider<StaticResourceContribution>;

  onStart() {
    for (const contribution of this.contributions.getContributions()) {
      contribution.registerStaticResolver(this.staticResourceService);
    }
  }
}
