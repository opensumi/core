import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { Provider, Injectable, Autowired } from '@ali/common-di';
import { ClientAppContribution, ContributionProvider } from '@ali/ide-core-browser';
import { LanguageClientFactory } from './language-client-factory';
import { MonacoService } from '@ali/ide-monaco';
import { LanguageContribution, LanguageContributionProvider } from './language-client-contribution';

@Injectable()
@Domain(ClientAppContribution)
export class LanguageFrontendContribution implements ClientAppContribution {

  @Autowired(LanguageContributionProvider)
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
        // TODO 与当前打开的文件uri对比
        contribution.waitForActivate();
      }
    });
  }
}
