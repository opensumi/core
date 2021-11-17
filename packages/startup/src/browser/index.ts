import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { StartupContribution } from './startup.contribution';

@Injectable()
export class StartupModule extends BrowserModule {
  providers: Provider[] = [
    StartupContribution,
  ];
}
