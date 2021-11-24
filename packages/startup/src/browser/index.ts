import { Provider, Injectable } from '@opensumi/common-di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { StartupContribution } from './startup.contribution';

@Injectable()
export class StartupModule extends BrowserModule {
  providers: Provider[] = [
    StartupContribution,
  ];
}
