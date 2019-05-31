import { Provider, Injectable, Autowired } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { LanguageClientProvider } from './language-client-provider';
import { CommandRegistry } from '_@phosphor_commands@1.6.1@@phosphor/commands/lib';

@Injectable()
export class LanguageModule extends BrowserModule {
  providers: Provider[] = [];
  slotMap: SlotMap = new Map();

  @Autowired()
  clientProvider: LanguageClientProvider;

  @Autowired()
  commandRegistry: CommandRegistry;

  active() {
    for (const contribution of this.clientProvider.contributions) {
      // TODO 与当前打开的文件uri对比
      this.commandRegistry.execute(`language.client.${contribution.id}.activate`);
      break;
    }
  }
}
