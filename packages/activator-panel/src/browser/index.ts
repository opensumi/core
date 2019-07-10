import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { ActivatorPanel } from './activator-panel.view';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class ActivatorPanelModule extends BrowserModule {
  providers: Provider[] = [];
  component = ActivatorPanel;
}
