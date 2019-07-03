import { Domain } from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { ContributionProvider } from '@ali/ide-core-browser';
import { LanguageClientFactory } from './language-client-factory';
import { MonacoService, MonacoContribution } from '@ali/ide-monaco';
import { LanguageContribution } from './language-client-contribution';

@Domain(MonacoContribution)
export class LanguageFrontendContribution implements MonacoContribution {

  @Autowired(LanguageContribution)
  contribution: ContributionProvider<LanguageContribution>;

  @Autowired()
  clientFactory: LanguageClientFactory;

  onMonacoLoaded(monacoService: MonacoService) {
    this.clientFactory.initServices();
    for (const contribution of this.contribution.getContributions()) {
      contribution.waitForActivate();
    }
  }

}
