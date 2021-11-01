import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { StartupContribution } from './startup.contribution';

@Injectable()
export class StartupModule extends BrowserModule {
  providers: Provider[] = [
    StartupContribution,
  ];
}
