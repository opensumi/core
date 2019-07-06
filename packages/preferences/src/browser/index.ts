import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule} from '@ali/ide-core-browser';
import { HelloWorld } from './preferences.view';

@Injectable()
export class PreferencesModule extends BrowserModule {
  providers: Provider[] = [];

  component = HelloWorld;
}
