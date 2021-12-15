import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule, Domain, ClientAppContribution } from '@opensumi/ide-core-browser';

@Domain(ClientAppContribution)
class MonacoEnhanceContribution implements ClientAppContribution {
  onDidStart() {}
}

@Injectable()
export class MonacoEnhanceModule extends BrowserModule {
  providers: Provider[] = [MonacoEnhanceContribution];
}
