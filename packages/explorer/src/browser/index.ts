import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule} from '@ide-framework/ide-core-browser';
import { ExplorerContribution } from './explorer-contribution';

@Injectable()
export class ExplorerModule extends BrowserModule {
  providers: Provider[] = [
    ExplorerContribution,
  ];
}
