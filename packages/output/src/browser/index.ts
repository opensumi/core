import { Provider, Injectable } from '@ide-framework/common-di';
import { OutputContribution } from './output-contribution';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { bindOutputPreference } from './output-preference';

@Injectable()
export class OutputModule extends BrowserModule {
  providers: Provider[] = [
    OutputContribution,
  ];

  preferences = bindOutputPreference;
}
