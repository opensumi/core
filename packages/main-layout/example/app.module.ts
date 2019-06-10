import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { AppLogicContribution } from './app.contribution';

@Injectable()
export class AppLogicModule extends BrowserModule {
  providers: Provider[] = [
    AppLogicContribution,
  ];
}
