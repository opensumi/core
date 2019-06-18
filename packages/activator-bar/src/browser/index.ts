import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { ActivatorBar } from './activator-bar.view';

@Injectable()
export class ActivatorBarModule extends BrowserModule {
  providers: Provider[] = [];
  component = ActivatorBar;
}
