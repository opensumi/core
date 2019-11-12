import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, Domain, ClientAppContribution } from '@ali/ide-core-browser';
import { ZoneWidget } from './zone-widget';

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
