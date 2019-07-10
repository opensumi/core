import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { ActivatorBar } from './activator-bar.view';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class ActivatorBarModule extends BrowserModule {
  providers: Provider[] = [];
  component = ActivatorBar;
}
