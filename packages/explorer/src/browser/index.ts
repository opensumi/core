import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { ExplorerContribution } from './explorer-contribution';

@Injectable()
export class ExplorerModule extends BrowserModule {
  providers: Provider[] = [ExplorerContribution];
}
