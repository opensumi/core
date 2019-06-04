import { Provider, Injectable, Autowired } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { CommandService, CommandContribution } from '@ali/ide-core-common';
import { BrowserModule } from '@ali/ide-core-browser';
import { LanguageClientProvider } from './language-client-provider';
import { LanguageClientFactory } from './language-client-factory';
import { MonacoService } from '@ali/ide-monaco';

@Injectable()
export class LanguageModule extends BrowserModule {
  providers: Provider[] = [];
  slotMap: SlotMap = new Map();

  // TODO 我想声明的是一个抽象类……command的机制不完善
  // @ts-ignore
  // contributionsCls: [TypescriptClientContribution]

  @Autowired()
  clientProvider: LanguageClientProvider;

  @Autowired(CommandService)
  commandService: CommandService;

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

  active() {
    this.waitUntilMonacoLoaded().then(() => {
      for (const contribution of this.clientProvider.contributions) {
        // TODO 与当前打开的文件uri对比
        contribution.activate();
        break;
      }
    });

  }
}
