import { LanguageClientContribution } from './language-client-contribution';
import { TypescriptClientContribution } from './typescript-client-contribution';
import { Injectable, Injector, INJECTOR_TOKEN, Autowired } from '@ali/common-di';

@Injectable()
export class LanguageClientProvider {
  @Autowired(INJECTOR_TOKEN)
  protected injector: Injector;

  // TODO 需要
  contributions: LanguageClientContribution[] = [this.injector.get(TypescriptClientContribution)];
}
