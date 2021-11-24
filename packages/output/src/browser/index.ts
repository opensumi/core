import { Provider, Injectable } from '@opensumi/common-di';
import { OutputContribution } from './output-contribution';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { bindOutputPreference } from './output-preference';

@Injectable()
export class OutputModule extends BrowserModule {
  providers: Provider[] = [
    OutputContribution,
  ];

  preferences = bindOutputPreference;
}
