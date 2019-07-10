import { Provider, Injectable } from '@ali/common-di';
import { GitContribution } from './git-contribution';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class GitModule extends BrowserModule {
  providers: Provider[] = [
    GitContribution,
  ];
}
