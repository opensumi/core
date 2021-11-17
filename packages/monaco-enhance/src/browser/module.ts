import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule, Domain, ClientAppContribution } from '@ide-framework/ide-core-browser';

@Domain(ClientAppContribution)
class MonacoEnhanceContribution implements ClientAppContribution {
  onDidStart() {
  }
}

@Injectable()
export class MonacoEnhanceModule extends BrowserModule {
  providers: Provider[] = [
    MonacoEnhanceContribution,
  ];
}
