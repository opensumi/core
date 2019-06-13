import { Domain } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { ClientAppContribution, ContributionProvider } from '@ali/ide-core-browser';
import { LanguageClientFactory } from './language-client-factory';
import { MonacoService } from '@ali/ide-monaco';
import { LanguageContribution } from './language-client-contribution';

@Injectable()
@Domain(ClientAppContribution)
export class LanguageFrontendContribution implements ClientAppContribution {

  @Autowired(LanguageContribution)
  contribution: ContributionProvider<LanguageContribution>;

  @Autowired()
  monacoService: MonacoService;

  @Autowired()
  clientFactory: LanguageClientFactory;

  waitUntilMonacoLoaded() {
    return new Promise((resolve, reject) => {
      this.monacoService.onMonacoLoaded((loaded) => {
        if (loaded) {
          this.clientFactory.initServices();
          resolve();
        } else {
          reject();
        }
      });
    });
  }

  onStart() {
    this.waitUntilMonacoLoaded().then(() => {
      for (const contribution of this.contribution.getContributions()) {
        contribution.waitForActivate();
      }
    });
  }
}
