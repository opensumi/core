import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule, ClientAppContribution, Domain } from '@opensumi/ide-core-browser';

@Domain(ClientAppContribution)
class MonacoEnhanceContribution implements ClientAppContribution {
  onDidStart() {}
}

@Injectable()
export class MonacoEnhanceModule extends BrowserModule {
  providers: Provider[] = [MonacoEnhanceContribution];
}
