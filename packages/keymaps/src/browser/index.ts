import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { HelloWorld } from './hello-world.view';

@Injectable()
export class KeymapsModule extends BrowserModule {
  providers: Provider[] = [];

  component = HelloWorld;
}
