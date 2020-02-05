import { Provider, Injectable } from '@ali/common-di';
import { OutputContribution } from './output-contribution';
import { BrowserModule } from '@ali/ide-core-browser';
import { bindOutputPreference } from './output-preference';

@Injectable()
export class OutputModule extends BrowserModule {
  providers: Provider[] = [
    OutputContribution,
  ];

  preferences = bindOutputPreference;
}
