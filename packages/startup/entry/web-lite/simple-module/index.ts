import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { SampleContribution } from './sample.contribution';

@Injectable()
export class SimpleModule extends BrowserModule {
  providers: Provider[] = [
    SampleContribution,
  ];

}
