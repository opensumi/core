import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { OutputContribution } from './output-contribution';
import { bindOutputPreference } from './output-preference';

@Injectable()
export class OutputModule extends BrowserModule {
  providers: Provider[] = [OutputContribution];

  preferences = bindOutputPreference;
}
