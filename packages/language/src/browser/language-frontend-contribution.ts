import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { Provider, Injectable, Autowired } from '@ali/common-di';
import { ClientAppContribution } from '@ali/ide-core-browser';
import { LanguageClientProvider } from './language-client-provider';
import { LanguageClientFactory } from './language-client-factory';
import { MonacoService } from '@ali/ide-monaco';

@Injectable()
@Domain(ClientAppContribution)
export class LanguageFrontendContribution implements ClientAppContribution {

  @Autowired()
  clientProvider: LanguageClientProvider;

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
      for (const contribution of this.clientProvider.contributions) {
        // TODO 与当前打开的文件uri对比
        contribution.waitForActivate();
      }
    });
  }
}
